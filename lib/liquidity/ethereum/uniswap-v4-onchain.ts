import { Contract, Interface, JsonRpcProvider, ZeroAddress, getAddress, zeroPadValue } from 'ethers'
import { Ether, Token, type Currency } from '@uniswap/sdk-core'
import { DYNAMIC_FEE_FLAG, Pool as V4Pool, Position as V4Position } from '@uniswap/v4-sdk'
import JSBI from 'jsbi'
import { calculatePnL } from '@/lib/liquidity/business'
import { getCoingeckoRequestParts } from '@/lib/coingecko-server'
import { liquidityChainForUniswapEvm } from '@/lib/liquidity/ethereum/evm-chain-meta'
import { getEvmUniswapConfig } from '@/lib/liquidity/ethereum/evm-uniswap-config'
import { getEvmUniswapV4Config } from '@/lib/liquidity/ethereum/evm-uniswap-v4-config'
import { fetchEthUsdSpot } from '@/lib/liquidity/prices-server'
import type { LiquidityPosition, LiquidityPositionsResult } from '@/lib/liquidity/types'

const CHUNK_BLOCKS = 1_800
const PARALLEL_CHUNKS = 28
const MAX_SCAN_BLOCKS = 5_400_000

const IFACE_721 = new Interface([
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
])

const V4_PM_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getPoolAndPositionInfo(uint256 tokenId) view returns ((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, uint256 info)',
  'function getPositionLiquidity(uint256 tokenId) view returns (uint128 liquidity)',
]

const STATE_VIEW_ABI = [
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)',
]

const ERC20_ABI = ['function decimals() view returns (uint8)', 'function symbol() view returns (string)']

async function fetchCoingeckoContractUsd(
  addresses: string[],
  coingeckoPlatform: string,
): Promise<Record<string, number>> {
  const uniq = [...new Set(addresses.map((a) => a.toLowerCase()))].filter(Boolean).slice(0, 60)
  if (!uniq.length) return {}
  const { base, headers } = getCoingeckoRequestParts()
  const out: Record<string, number> = {}
  const chunk = 28
  for (let i = 0; i < uniq.length; i += chunk) {
    const part = uniq.slice(i, i + chunk)
    const url = `${base}/simple/token_price/${encodeURIComponent(coingeckoPlatform)}?contract_addresses=${part.join(',')}&vs_currencies=usd`
    const res = await fetch(url, { headers, cache: 'no-store' })
    if (!res.ok) continue
    const data = (await res.json()) as Record<string, { usd?: number }>
    for (const addr of part) {
      const row = data[addr.toLowerCase()]
      const u = Number(row?.usd)
      if (Number.isFinite(u) && u > 0) out[addr.toLowerCase()] = u
    }
  }
  return out
}

async function runPool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0
  async function worker() {
    for (;;) {
      const i = next++
      if (i >= tasks.length) break
      results[i] = await tasks[i]!()
    }
  }
  const n = Math.min(limit, tasks.length) || 1
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

function rpcEnvHint(chainId: number): string {
  if (chainId === 1) return 'ETH_RPC_URL (ou ETHEREUM_RPC_URL)'
  if (chainId === 42161) return 'ARBITRUM_RPC_URL'
  if (chainId === 8453) return 'BASE_RPC_URL'
  if (chainId === 137) return 'POLYGON_RPC_URL'
  if (chainId === 56) return 'BSC_RPC_URL'
  return 'RPC'
}

function decodePositionTicks(infoPacked: bigint): { tickLower: number; tickUpper: number } {
  const tickUpperRaw = Number((infoPacked >> 32n) & 0xffffffn)
  const tickLowerRaw = Number((infoPacked >> 8n) & 0xffffffn)
  const sx = (raw: number) => (raw >= 0x800000 ? raw - 0x1000000 : raw)
  return { tickLower: sx(tickLowerRaw), tickUpper: sx(tickUpperRaw) }
}

function asCurrency(chainId: number, tokenAddress: string, decimals: number, symbol: string): Currency {
  if (tokenAddress.toLowerCase() === ZeroAddress.toLowerCase()) {
    return Ether.onChain(chainId)
  }
  return new Token(chainId, getAddress(tokenAddress), decimals, symbol, symbol)
}

/**
 * Posições Uniswap v4 (NFT no PositionManager + leitura de pool via StateView).
 * Descoberta de tokenIds: eventos Transfer (mesmo padrão que v3; v4 não expõe enumerable).
 */
export async function getUniswapV4PositionsOnChain(
  ownerInput: string,
  chainId: number,
): Promise<LiquidityPositionsResult> {
  const v4 = getEvmUniswapV4Config(chainId)
  const rpcCfg = getEvmUniswapConfig(chainId)
  if (!v4 || !rpcCfg) {
    return {
      positions: [],
      meta: {
        source: 'uniswap-v4-onchain',
        warning: 'Rede não suportada para Uniswap v4 nesta app.',
      },
    }
  }

  const liqChain = liquidityChainForUniswapEvm(v4.chainId)
  const sdkChainId = v4.chainId
  const owner = getAddress(ownerInput)
  const transferTopic = IFACE_721.getEvent('Transfer')!.topicHash
  const topicTo = zeroPadValue(owner, 32)
  const rpcHint = rpcEnvHint(chainId)

  const { urls: rpcList, fromEnv: rpcFromEnv } = rpcCfg.rpcUrls()
  let provider: JsonRpcProvider | undefined
  let pm: Contract | undefined
  let balance: bigint | undefined
  for (const url of rpcList) {
    const p = new JsonRpcProvider(url, sdkChainId)
    const c = new Contract(v4.positionManager, V4_PM_ABI, p)
    try {
      balance = await c.balanceOf(owner)
      provider = p
      pm = c
      break
    } catch {
      /* next RPC */
    }
  }

  if (provider == null || pm == null || balance === undefined) {
    const warning = rpcFromEnv
      ? `RPC ${rpcCfg.shortLabel} (v4): falha no URL configurado. Confirma ${rpcHint} e redeploy.`
      : `RPC ${rpcCfg.shortLabel} (v4) indisponível. Define ${rpcHint} (Alchemy/Infura).`
    return { positions: [], meta: { source: 'uniswap-v4-onchain', warning } }
  }

  if (balance === 0n) {
    return { positions: [], meta: { source: 'uniswap-v4-onchain', warning: undefined } }
  }

  const stateView = new Contract(v4.stateView, STATE_VIEW_ABI, provider)
  const latest = Number(await provider.getBlockNumber())
  const fromBlock = Math.max(v4.pmDeployBlock, latest - MAX_SCAN_BLOCKS)

  const chunks: { from: number; to: number }[] = []
  for (let b = fromBlock; b <= latest; b += CHUNK_BLOCKS) {
    chunks.push({ from: b, to: Math.min(b + CHUNK_BLOCKS - 1, latest) })
  }

  const logTasks = chunks.map(
    ({ from, to }) => () =>
      provider!.getLogs({
        address: v4.positionManager,
        topics: [transferTopic, null, topicTo],
        fromBlock: from,
        toBlock: to,
      }),
  )

  let allLogs: Awaited<ReturnType<JsonRpcProvider['getLogs']>> = []
  try {
    const batches = await runPool(logTasks, PARALLEL_CHUNKS)
    allLogs = batches.flat()
  } catch {
    return {
      positions: [],
      meta: {
        source: 'uniswap-v4-onchain',
        warning: `eth_getLogs falhou (${rpcCfg.shortLabel}, v4). Usa ${rpcHint} com histórico largo.`,
      },
    }
  }

  const tokenIdSet = new Set<string>()
  for (const log of allLogs) {
    const t = log.topics[3]
    if (!t) continue
    tokenIdSet.add(BigInt(t).toString())
  }

  const candidates = [...tokenIdSet].sort((a, b) => Number(b) - Number(a)).slice(0, 200)
  const ownedIds: bigint[] = []
  for (const idStr of candidates) {
    const id = BigInt(idStr)
    try {
      const o = await pm.ownerOf(id)
      if (getAddress(o) === owner) ownedIds.push(id)
    } catch {
      /* burned */
    }
    if (ownedIds.length >= Number(balance)) break
  }

  if (ownedIds.length === 0) {
    return {
      positions: [],
      meta: {
        source: 'uniswap-v4-onchain',
        warning: `Tens NFTs v4 em ${rpcCfg.shortLabel} (balanceOf > 0), mas não encontrámos tokenIds na janela de blocos. Aumenta RPC archive ou o histórico.`,
      },
    }
  }

  type PoolKeyStruct = {
    currency0: string
    currency1: string
    fee: number
    tickSpacing: number
    hooks: string
  }

  const rows: {
    tokenId: bigint
    poolKey: PoolKeyStruct
    tickLower: number
    tickUpper: number
    liquidity: bigint
 }[] = []

  for (const tokenId of ownedIds) {
    try {
      const res = await pm.getPoolAndPositionInfo(tokenId)
      const poolKey = res.poolKey as PoolKeyStruct
      const infoPacked = BigInt(res.info.toString())
      const liq = await pm.getPositionLiquidity(tokenId)
      const { tickLower, tickUpper } = decodePositionTicks(infoPacked)
      if (liq === 0n) continue
      rows.push({ tokenId, poolKey, tickLower, tickUpper, liquidity: BigInt(liq.toString()) })
    } catch {
      /* skip */
    }
  }

  const ethUsd = await fetchEthUsdSpot()
  const wrappedLower = rpcCfg.wrappedNativeLower

  const tokenAddrs = new Set<string>()
  for (const r of rows) {
    if (r.poolKey.currency0.toLowerCase() !== ZeroAddress.toLowerCase()) {
      tokenAddrs.add(getAddress(r.poolKey.currency0))
    }
    if (r.poolKey.currency1.toLowerCase() !== ZeroAddress.toLowerCase()) {
      tokenAddrs.add(getAddress(r.poolKey.currency1))
    }
  }

  const decimalsCache = new Map<string, number>()
  const symbolCache = new Map<string, string>()
  for (const a of tokenAddrs) {
    try {
      const c = new Contract(a, ERC20_ABI, provider)
      const [d, s] = await Promise.all([
        c.decimals().catch(() => 18),
        c.symbol().catch(() => '?'),
      ])
      decimalsCache.set(a.toLowerCase(), Number(d))
      symbolCache.set(a.toLowerCase(), String(s))
    } catch {
      decimalsCache.set(a.toLowerCase(), 18)
      symbolCache.set(a.toLowerCase(), '?')
    }
  }

  function nativeSymbol(chainId: number): string {
    if (chainId === 56) return 'BNB'
    if (chainId === 137) return 'MATIC'
    return 'ETH'
  }

  function metaForCurrency(addr: string): { decimals: number; symbol: string } {
    if (addr.toLowerCase() === ZeroAddress.toLowerCase()) {
      return { decimals: 18, symbol: nativeSymbol(sdkChainId) }
    }
    const lower = getAddress(addr).toLowerCase()
    return {
      decimals: decimalsCache.get(lower) ?? 18,
      symbol: symbolCache.get(lower) ?? '?',
    }
  }

  const priceByAddr = await fetchCoingeckoContractUsd([...tokenAddrs], rpcCfg.coingeckoPlatform)
  const useEthSpot =
    sdkChainId === 1 || sdkChainId === 42161 || sdkChainId === 8453
  if (useEthSpot && ethUsd > 0 && !priceByAddr[wrappedLower]) {
    priceByAddr[wrappedLower] = ethUsd
  }

  const positions: LiquidityPosition[] = []

  for (const r of rows) {
    const m0 = metaForCurrency(r.poolKey.currency0)
    const m1 = metaForCurrency(r.poolKey.currency1)
    const c0 = asCurrency(sdkChainId, r.poolKey.currency0, m0.decimals, m0.symbol)
    const c1 = asCurrency(sdkChainId, r.poolKey.currency1, m1.decimals, m1.symbol)

    let pool: V4Pool
    try {
      const poolId = V4Pool.getPoolId(c0, c1, r.poolKey.fee, r.poolKey.tickSpacing, r.poolKey.hooks)
      const slot0 = await stateView.getSlot0(poolId)
      const sqrtPriceX96 = slot0.sqrtPriceX96
      const tickCurrent = Number(slot0.tick)
      const poolLiquidity = await stateView.getLiquidity(poolId)
      pool = new V4Pool(
        c0,
        c1,
        r.poolKey.fee,
        r.poolKey.tickSpacing,
        r.poolKey.hooks,
        sqrtPriceX96.toString(),
        poolLiquidity.toString(),
        tickCurrent,
      )
    } catch {
      continue
    }

    let amount0: number
    let amount1: number
    try {
      const posSdk = new V4Position({
        pool,
        liquidity: JSBI.BigInt(r.liquidity.toString()),
        tickLower: r.tickLower,
        tickUpper: r.tickUpper,
      })
      amount0 = Number(posSdk.amount0.toExact())
      amount1 = Number(posSdk.amount1.toExact())
    } catch {
      continue
    }

    const addr0 =
      r.poolKey.currency0.toLowerCase() === ZeroAddress.toLowerCase()
        ? wrappedLower
        : getAddress(r.poolKey.currency0).toLowerCase()
    const addr1 =
      r.poolKey.currency1.toLowerCase() === ZeroAddress.toLowerCase()
        ? wrappedLower
        : getAddress(r.poolKey.currency1).toLowerCase()

    const p0 = priceByAddr[addr0] ?? 0
    const p1 = priceByAddr[addr1] ?? 0
    const valueUSD = amount0 * p0 + amount1 * p1
    const currentTick = pool.tickCurrent
    const inRange = currentTick >= r.tickLower && currentTick <= r.tickUpper

    let tokenAValuePct: number
    if (valueUSD > 1e-8 && p0 > 0) {
      tokenAValuePct = Math.round(((amount0 * p0) / valueUSD) * 100)
    } else if (currentTick < r.tickLower) {
      tokenAValuePct = 100
    } else if (currentTick > r.tickUpper) {
      tokenAValuePct = 0
    } else {
      tokenAValuePct = 50
    }

    const feeForLabel = r.poolKey.fee === DYNAMIC_FEE_FLAG ? 'dyn' : r.poolKey.fee

    positions.push({
      id: `${sdkChainId}-uni-v4-${r.tokenId.toString()}`,
      chain: liqChain,
      protocol: 'Uniswap v4',
      tokenA: m0.symbol,
      tokenB: m1.symbol,
      amountA: amount0,
      amountB: amount1,
      valueUSD,
      investedUSD: valueUSD,
      feesEarnedUSD: 0,
      pnlUSD: calculatePnL({ valueUSD, investedUSD: valueUSD, feesEarnedUSD: 0 }),
      pnlPct: 0,
      impermanentLossUSD: null,
      poolAddress: V4Pool.getPoolId(c0, c1, r.poolKey.fee, r.poolKey.tickSpacing, r.poolKey.hooks),
      feeTierBps: r.poolKey.fee === DYNAMIC_FEE_FLAG ? undefined : r.poolKey.fee,
      inRange,
      tickLower: r.tickLower,
      tickUpper: r.tickUpper,
      currentTick,
      decimalsA: m0.decimals,
      decimalsB: m1.decimals,
      tokenAValuePct,
      estimatedAprPct: undefined,
      positionKind: 'concentrated',
      raw: {
        tokenId: r.tokenId.toString(),
        source: 'uniswap-v4-rpc',
        chainId: sdkChainId,
        hooks: r.poolKey.hooks,
        feeDisplay: feeForLabel,
      },
    })
  }

  positions.sort((a, b) => b.valueUSD - a.valueUSD)

  return {
    positions,
    meta: {
      source: 'uniswap-v4-onchain',
      warning:
        positions.length === 0
          ? 'Não foi possível reconstruir pools v4 (StateView/RPC) para estes NFTs.'
          : 'Uniswap v4: valores USD via CoinGecko; fee dinâmica pode aparecer como tier especial.',
    },
  }
}
