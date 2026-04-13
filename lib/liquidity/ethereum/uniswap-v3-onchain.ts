import { Contract, Interface, JsonRpcProvider, ZeroAddress, getAddress, zeroPadValue } from 'ethers'
import { Token } from '@uniswap/sdk-core'
import { Pool, Position } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'
import { calculatePnL, pnlPercent } from '@/lib/liquidity/business'
import { getCoingeckoRequestParts } from '@/lib/coingecko-server'
import { estimateAprFromDexscreenerPool } from '@/lib/liquidity/dexscreener-pool-apr'
import { fetchEthUsdSpot } from '@/lib/liquidity/prices-server'
import type { LiquidityPosition, LiquidityPositionsResult } from '@/lib/liquidity/types'

const MAINNET_CHAIN = 1
/** NonfungiblePositionManager (Ethereum mainnet). */
const NPM = '0xC36442b4a4522E871399CD017aD59865a842ddfB'
const UNI_FACTORY = '0x1F9840a85d5aF5bf1D1762F925BDADd4201F984'

const NPM_DEPLOY_BLOCK = 12_369_621
/** Janela de blocos para eth_getLogs (RPCs públicos limitam o range por pedido). */
const CHUNK_BLOCKS = 1_800
const PARALLEL_CHUNKS = 28
/** ~5,4M blocos ≈ ~750 dias (7200 blocos/dia). */
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

function rpcUrl(): string {
  return (
    process.env.ETH_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_ETH_RPC_URL?.trim() ||
    'https://ethereum.publicnode.com'
  )
}

async function fetchCoingeckoContractUsd(addresses: string[]): Promise<Record<string, number>> {
  const uniq = [...new Set(addresses.map((a) => a.toLowerCase()))].filter(Boolean).slice(0, 60)
  if (!uniq.length) return {}
  const { base, headers } = getCoingeckoRequestParts()
  const out: Record<string, number> = {}
  const chunk = 28
  for (let i = 0; i < uniq.length; i += chunk) {
    const part = uniq.slice(i, i + chunk)
    const url = `${base}/simple/token_price/ethereum?contract_addresses=${part.join(',')}&vs_currencies=usd`
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

/**
 * Fallback sem The Graph: descobre NFTs v3 via logs de Transfer para o endereço,
 * confirma com ownerOf, lê positions() + pool slot0 e calcula montantes com o SDK.
 */
export async function getEthereumPositionsOnChain(ownerInput: string): Promise<LiquidityPositionsResult> {
  const owner = getAddress(ownerInput)
  const provider = new JsonRpcProvider(rpcUrl())
  const npm = new Contract(NPM, NPM_ABI, provider)
  const transferTopic = IFACE_721.getEvent('Transfer')!.topicHash
  const topicTo = zeroPadValue(owner, 32)

  let balance: bigint
  try {
    balance = await npm.balanceOf(owner)
  } catch {
    return {
      positions: [],
      meta: {
        source: 'uniswap-v3-onchain',
        warning:
          'RPC Ethereum indisponível. Define ETH_RPC_URL (Infura, Alchemy, etc.) ou THE_GRAPH_API_KEY.',
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
  const fromBlock = Math.max(NPM_DEPLOY_BLOCK, latest - MAX_SCAN_BLOCKS)

  const chunks: { from: number; to: number }[] = []
  for (let b = fromBlock; b <= latest; b += CHUNK_BLOCKS) {
    chunks.push({ from: b, to: Math.min(b + CHUNK_BLOCKS - 1, latest) })
  }

  const logTasks = chunks.map(
    ({ from, to }) => () =>
      provider.getLogs({
        address: NPM,
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
        warning:
          'eth_getLogs falhou (range ou rate limit do RPC). Usa ETH_RPC_URL com nó próprio ou THE_GRAPH_API_KEY.',
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
          'A carteira tem posições Uniswap v3 (balanceOf > 0), mas não encontrámos os NFTs nesta janela de blocos. ' +
          'Configura THE_GRAPH_API_KEY para listagem completa, ou ETH_RPC_URL com nó archive.',
      },
    }
  }

  const factory = new Contract(UNI_FACTORY, FACTORY_ABI, provider)
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
    fetchCoingeckoContractUsd(tokenAddrs),
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

  const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
  const priceByAddr = { ...priceByAddrRaw }
  if (ethUsd > 0 && (!priceByAddr[WETH] || priceByAddr[WETH]! <= 0)) {
    priceByAddr[WETH] = ethUsd
  }

  const positions: LiquidityPosition[] = []
  const aprCache = new Map<string, number | undefined>()
  async function aprForPool(pool: string, feeBps: number): Promise<number | undefined> {
    const k = `${pool.toLowerCase()}-${feeBps}`
    if (aprCache.has(k)) return aprCache.get(k)
    const v = await estimateAprFromDexscreenerPool({
      chain: 'ethereum',
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

    const t0 = new Token(MAINNET_CHAIN, r.token0, d0, sym0, sym0)
    const t1 = new Token(MAINNET_CHAIN, r.token1, d1, sym1, sym1)

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
      tokenAValuePct = Math.round((amount0 * p0) / valueUSD * 100)
    } else if (currentTick < r.tickLower) {
      tokenAValuePct = 100 // below range: all tokenA
    } else if (currentTick > r.tickUpper) {
      tokenAValuePct = 0 // above range: all tokenB
    } else {
      tokenAValuePct = 50
    }

    const estimatedAprPct = await aprForPool(poolAddrHex, r.fee)

    positions.push({
      id: `eth-uni-v3-onchain-${r.tokenId.toString()}`,
      chain: 'ethereum',
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
      raw: { tokenId: r.tokenId.toString(), source: 'rpc' },
    })
  }

  positions.sort((a, b) => b.valueUSD - a.valueUSD)

  return {
    positions,
    meta: {
      source: 'uniswap-v3-onchain',
      warning:
        positions.length === 0
          ? 'Não foi possível reconstruir pools/preços para estas posições.'
          : [
              'Dados via RPC público (sem The Graph). Principal investido = valor atual (sem histórico on-chain); P&amp;L pode ser 0.',
              ethUsd <= 0 ? 'Preço ETH indisponível; tokens podem aparecer a 0 USD.' : '',
              latest - fromBlock >= MAX_SCAN_BLOCKS - 1
                ? `Janela indexada: últimos ~${Math.floor(MAX_SCAN_BLOCKS / 7200)} dias de Transfer events.`
                : '',
            ]
              .filter(Boolean)
              .join(' '),
    },
  }
}
