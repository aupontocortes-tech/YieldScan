import { Contract, Interface, JsonRpcProvider, ZeroAddress, getAddress, zeroPadValue } from 'ethers'
import { Token } from '@uniswap/sdk-core'
import { Pool, Position } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'
import { calculatePnL, pnlPercent } from '@/lib/liquidity/business'
import { getCoingeckoRequestParts } from '@/lib/coingecko-server'
import { estimateAprFromDexscreenerPool } from '@/lib/liquidity/dexscreener-pool-apr'
import { liquidityChainForUniswapEvm } from '@/lib/liquidity/ethereum/evm-chain-meta'
import { getEvmUniswapConfig } from '@/lib/liquidity/ethereum/evm-uniswap-config'
import { fetchEthUsdSpot } from '@/lib/liquidity/prices-server'
import type { LiquidityPosition, LiquidityPositionsResult } from '@/lib/liquidity/types'

/** Janela de blocos para eth_getLogs (RPCs públicos limitam o range por pedido). */
const CHUNK_BLOCKS = 1_800
const PARALLEL_CHUNKS = 28
/** Histórico máximo a varrer (Transfer → NFT). */
const MAX_SCAN_BLOCKS = 5_400_000

const IFACE_721 = new Interface([
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
])

const NPM_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
]

const FACTORY_ABI = ['function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)']

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
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

function rpcEnvHint(shortLabel: string, chainId: number): string {
  if (chainId === 1) return 'ETH_RPC_URL'
  if (chainId === 42161) return 'ARBITRUM_RPC_URL'
  if (chainId === 8453) return 'BASE_RPC_URL'
  if (chainId === 137) return 'POLYGON_RPC_URL'
  if (chainId === 56) return 'BSC_RPC_URL'
  return `RPC (${shortLabel})`
}

/**
 * Fallback sem The Graph: descobre NFTs v3 via logs de Transfer para o endereço,
 * confirma com ownerOf, lê positions() + pool slot0 e calcula montantes com o SDK.
 */
export async function getEthereumPositionsOnChain(
  ownerInput: string,
  chainId: number = 1,
): Promise<LiquidityPositionsResult> {
  const cfg = getEvmUniswapConfig(chainId)
  if (!cfg) {
    return {
      positions: [],
      meta: {
        source: 'uniswap-v3-onchain',
        warning:
          'Rede EVM não suportada para Uniswap v3 nesta app (Ethereum, Arbitrum, Base, Polygon, BNB Chain).',
      },
    }
  }

  const liqChain = liquidityChainForUniswapEvm(cfg.chainId)
  const sdkChainId = cfg.chainId
  const owner = getAddress(ownerInput)
  const transferTopic = IFACE_721.getEvent('Transfer')!.topicHash
  const topicTo = zeroPadValue(owner, 32)
  const rpcHint = rpcEnvHint(cfg.shortLabel, cfg.chainId)

  const rpcList = cfg.rpcUrls()
  let provider: JsonRpcProvider | undefined
  let npm: Contract | undefined
  let balance: bigint | undefined
  for (const url of rpcList) {
    const p = new JsonRpcProvider(url, sdkChainId)
    const n = new Contract(cfg.positionManager, NPM_ABI, p)
    try {
      balance = await n.balanceOf(owner)
      provider = p
      npm = n
      break
    } catch {
      /* tenta próximo RPC */
    }
  }

  if (provider == null || npm == null || balance === undefined) {
    return {
      positions: [],
      meta: {
        source: 'uniswap-v3-onchain',
        warning: `RPC ${cfg.shortLabel} indisponível (vários nós públicos falharam). Define ${rpcHint} no .env.local (local) ou nas Environment Variables do projeto (ex.: Vercel) — Infura, Alchemy, etc.`,
      },
    }
  }

  if (balance === 0n) {
    return {
      positions: [],
      meta: {
        source: 'uniswap-v3-onchain',
        warning: undefined,
      },
    }
  }

  const latest = Number(await provider.getBlockNumber())
  const fromBlock = Math.max(cfg.npmDeployBlock, latest - MAX_SCAN_BLOCKS)

  const chunks: { from: number; to: number }[] = []
  for (let b = fromBlock; b <= latest; b += CHUNK_BLOCKS) {
    chunks.push({ from: b, to: Math.min(b + CHUNK_BLOCKS - 1, latest) })
  }

  const logTasks = chunks.map(
    ({ from, to }) => () =>
      provider.getLogs({
        address: cfg.positionManager,
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
        source: 'uniswap-v3-onchain',
        warning: `eth_getLogs falhou (${cfg.shortLabel}). Usa ${rpcHint} com nó próprio ou menos rate limit.`,
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
      const o = await npm.ownerOf(id)
      if (getAddress(o) === owner) ownedIds.push(id)
    } catch {
      /* burned or invalid */
    }
    if (ownedIds.length >= Number(balance)) break
  }

  if (ownedIds.length === 0) {
    return {
      positions: [],
      meta: {
        source: 'uniswap-v3-onchain',
        warning:
          `A carteira tem posições Uniswap v3 em ${cfg.shortLabel} (balanceOf > 0), mas não encontrámos os NFTs nesta janela de blocos. ` +
          `Para Ethereum, THE_GRAPH_API_KEY ou nó archive ajudam; noutras redes, ${rpcHint} com histórico largo.`,
      },
    }
  }

  const factory = new Contract(cfg.factory, FACTORY_ABI, provider)
  const ethUsd = await fetchEthUsdSpot()

  type PosRow = {
    tokenId: bigint
    token0: string
    token1: string
    fee: number
    tickLower: number
    tickUpper: number
    liquidity: bigint
    tokensOwed0: bigint
    tokensOwed1: bigint
  }

  const rows: PosRow[] = []
  for (const tokenId of ownedIds) {
    try {
      const p = await npm.positions(tokenId)
      const liq = p.liquidity as bigint
      if (liq === 0n) continue
      rows.push({
        tokenId,
        token0: getAddress(p.token0 as string),
        token1: getAddress(p.token1 as string),
        fee: Number(p.fee),
        tickLower: Number(p.tickLower),
        tickUpper: Number(p.tickUpper),
        liquidity: liq,
        tokensOwed0: BigInt(p.tokensOwed0.toString()),
        tokensOwed1: BigInt(p.tokensOwed1.toString()),
      })
    } catch {
      /* skip */
    }
  }

  const poolCache = new Map<
    string,
    { poolAddr: string; sqrtPriceX96: bigint; tick: number; liquidity: bigint }
  >()

  for (const r of rows) {
    const key = `${r.token0}-${r.token1}-${r.fee}`
    if (poolCache.has(key)) continue
    try {
      const poolAddr: string = await factory.getPool(r.token0, r.token1, r.fee)
      if (!poolAddr || getAddress(poolAddr) === ZeroAddress) continue
      const poolC = new Contract(poolAddr, POOL_ABI, provider)
      const s0 = await poolC.slot0()
      const liq = await poolC.liquidity()
      poolCache.set(key, {
        poolAddr: getAddress(poolAddr),
        sqrtPriceX96: BigInt(s0.sqrtPriceX96.toString()),
        tick: Number(s0.tick),
        liquidity: BigInt(liq.toString()),
      })
    } catch {
      /* skip pool */
    }
  }

  const tokenAddrs = [...new Set(rows.flatMap((r) => [r.token0, r.token1]))]
  const [priceByAddrRaw, decimalsCache] = await Promise.all([
    fetchCoingeckoContractUsd(tokenAddrs, cfg.coingeckoPlatform),
    (async () => {
      const m = new Map<string, number>()
      for (const a of tokenAddrs) {
        try {
          const c = new Contract(a, ERC20_ABI, provider)
          const d = await c.decimals()
          m.set(a.toLowerCase(), Number(d))
        } catch {
          m.set(a.toLowerCase(), 18)
        }
      }
      return m
    })(),
  ])

  const wrapped = cfg.wrappedNativeLower
  const priceByAddr = { ...priceByAddrRaw }
  /** Só faz sentido usar spot ETH para WETH (L1/L2 com WETH); não para WMATIC/WBNB. */
  const useEthSpotForWrappedNative =
    cfg.chainId === 1 || cfg.chainId === 42161 || cfg.chainId === 8453
  if (
    useEthSpotForWrappedNative &&
    ethUsd > 0 &&
    (!priceByAddr[wrapped] || priceByAddr[wrapped]! <= 0)
  ) {
    priceByAddr[wrapped] = ethUsd
  }

  const positions: LiquidityPosition[] = []
  const aprCache = new Map<string, number | undefined>()
  async function aprForPool(pool: string, feeBps: number): Promise<number | undefined> {
    const k = `${pool.toLowerCase()}-${feeBps}`
    if (aprCache.has(k)) return aprCache.get(k)
    const v = await estimateAprFromDexscreenerPool({
      chain: liqChain,
      poolAddress: pool,
      feeTierBps: feeBps,
    })
    aprCache.set(k, v)
    return v
  }

  for (const r of rows) {
    const key = `${r.token0}-${r.token1}-${r.fee}`
    const poolState = poolCache.get(key)
    if (!poolState) continue
    const poolAddrHex = poolState.poolAddr

    const d0 = decimalsCache.get(r.token0.toLowerCase()) ?? 18
    const d1 = decimalsCache.get(r.token1.toLowerCase()) ?? 18

    let sym0 = 'T0'
    let sym1 = 'T1'
    try {
      const c0 = new Contract(r.token0, ERC20_ABI, provider)
      const c1 = new Contract(r.token1, ERC20_ABI, provider)
      const [s0, s1] = await Promise.all([
        c0.symbol().catch(() => 'T0'),
        c1.symbol().catch(() => 'T1'),
      ])
      sym0 = String(s0)
      sym1 = String(s1)
    } catch {
      /* defaults */
    }

    const t0 = new Token(sdkChainId, r.token0, d0, sym0, sym0)
    const t1 = new Token(sdkChainId, r.token1, d1, sym1, sym1)

    let amount0: number
    let amount1: number
    try {
      const poolSdk = new Pool(
        t0,
        t1,
        r.fee,
        JSBI.BigInt(poolState.sqrtPriceX96.toString()),
        JSBI.BigInt(poolState.liquidity.toString()),
        poolState.tick,
      )
      const positionSdk = new Position({
        pool: poolSdk,
        liquidity: JSBI.BigInt(r.liquidity.toString()),
        tickLower: r.tickLower,
        tickUpper: r.tickUpper,
      })
      amount0 = Number(positionSdk.amount0.toExact())
      amount1 = Number(positionSdk.amount1.toExact())
    } catch {
      continue
    }

    const p0 = priceByAddr[r.token0.toLowerCase()] ?? 0
    const p1 = priceByAddr[r.token1.toLowerCase()] ?? 0
    const owed0 = Number(r.tokensOwed0) / 10 ** d0
    const owed1 = Number(r.tokensOwed1) / 10 ** d1

    const valueUSD = amount0 * p0 + amount1 * p1
    const feesEarnedUSD = owed0 * p0 + owed1 * p1
    const investedUSD = valueUSD
    const pnlUSD = calculatePnL({ valueUSD, investedUSD, feesEarnedUSD })

    const currentTick = poolState.tick
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

    const estimatedAprPct = await aprForPool(poolAddrHex, r.fee)

    positions.push({
      id: `${cfg.chainId}-uni-v3-onchain-${r.tokenId.toString()}`,
      chain: liqChain,
      protocol: 'Uniswap v3',
      tokenA: sym0,
      tokenB: sym1,
      amountA: amount0,
      amountB: amount1,
      valueUSD,
      investedUSD,
      feesEarnedUSD,
      pnlUSD,
      pnlPct: pnlPercent(pnlUSD, investedUSD),
      impermanentLossUSD: null,
      poolAddress: poolAddrHex,
      feeTierBps: r.fee,
      inRange,
      tickLower: r.tickLower,
      tickUpper: r.tickUpper,
      currentTick,
      decimalsA: d0,
      decimalsB: d1,
      tokenAValuePct,
      estimatedAprPct,
      positionKind: 'concentrated',
      raw: { tokenId: r.tokenId.toString(), source: 'rpc', chainId: cfg.chainId },
    })
  }

  positions.sort((a, b) => b.valueUSD - a.valueUSD)

  const tailWarning =
    latest - fromBlock >= MAX_SCAN_BLOCKS - 1
      ? 'A pesquisa de NFTs cobre só uma janela recente de blocos; posições muito antigas podem não aparecer.'
      : ''

  return {
    positions,
    meta: {
      source: 'uniswap-v3-onchain',
      warning:
        positions.length === 0
          ? 'Não foi possível reconstruir pools/preços para estas posições.'
          : [
              `Dados via RPC (${cfg.shortLabel}, sem The Graph nesta rede). Principal investido = valor atual; P&amp;L pode ser 0.`,
              useEthSpotForWrappedNative && ethUsd <= 0
                ? 'Preço spot ETH indisponível; WETH pode aparecer a 0 USD.'
                : '',
              tailWarning,
            ]
              .filter(Boolean)
              .join(' '),
    },
  }
}
