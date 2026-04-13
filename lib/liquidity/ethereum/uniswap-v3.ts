import { Token } from '@uniswap/sdk-core'
import { Pool, Position } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'
import { calculateImpermanentLoss, calculatePnL, pnlPercent } from '@/lib/liquidity/business'
import { estimateAprFromDexscreenerPool } from '@/lib/liquidity/dexscreener-pool-apr'
import {
  isSupportedEvmUniswapChainId,
  liquidityChainForUniswapEvm,
} from '@/lib/liquidity/ethereum/evm-uniswap-config'
import { getEthereumPositionsOnChain } from '@/lib/liquidity/ethereum/uniswap-v3-onchain'
import { fetchEthUsdSpot, usdFromDerivedEth } from '@/lib/liquidity/prices-server'
import type { LiquidityChain, LiquidityPosition, LiquidityPositionsResult } from '@/lib/liquidity/types'

const MAINNET_CHAIN_ID = 1
const DEFAULT_SUBGRAPH_ID = '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV'

type GqlToken = {
  id: string
  symbol?: string
  name?: string
  decimals?: string
  derivedETH?: string
}

type GqlPool = {
  id: string
  feeTier: string
  sqrtPrice: string
  tick: string
  liquidity: string
  token0: GqlToken
  token1: GqlToken
}

type GqlPosition = {
  id: string
  liquidity: string
  depositedToken0: string
  depositedToken1: string
  withdrawnToken0: string
  withdrawnToken1: string
  collectedFeesToken0: string
  collectedFeesToken1: string
  tickLower: unknown
  tickUpper: unknown
  pool: GqlPool
}

function tickIdx(raw: unknown): number {
  if (raw == null) return 0
  if (typeof raw === 'object' && raw !== null && 'tickIdx' in raw) {
    return Number((raw as { tickIdx: string | number }).tickIdx)
  }
  return Number(raw)
}

function parseBd(s: string): number {
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function subgraphEndpoint(): string | null {
  const full = process.env.UNISWAP_V3_SUBGRAPH_URL?.trim()
  if (full) return full
  const key = process.env.THE_GRAPH_API_KEY?.trim()
  if (!key) return null
  const id = process.env.UNISWAP_V3_SUBGRAPH_ID?.trim() || DEFAULT_SUBGRAPH_ID
  return `https://gateway.thegraph.com/api/${key}/subgraphs/id/${id}`
}

const POSITIONS_QUERY = `
query Positions($owner: String!) {
  positions(
    first: 100
    where: { owner: $owner }
    orderBy: id
    orderDirection: desc
  ) {
    id
    liquidity
    depositedToken0
    depositedToken1
    withdrawnToken0
    withdrawnToken1
    collectedFeesToken0
    collectedFeesToken1
    tickLower { tickIdx }
    tickUpper { tickIdx }
    pool {
      id
      feeTier
      sqrtPrice
      tick
      liquidity
      token0 { id symbol decimals derivedETH name }
      token1 { id symbol decimals derivedETH name }
    }
  }
}
`

const POSITIONS_QUERY_SCALAR_TICKS = `
query Positions($owner: String!) {
  positions(
    first: 100
    where: { owner: $owner }
    orderBy: id
    orderDirection: desc
  ) {
    id
    liquidity
    depositedToken0
    depositedToken1
    withdrawnToken0
    withdrawnToken1
    collectedFeesToken0
    collectedFeesToken1
    tickLower
    tickUpper
    pool {
      id
      feeTier
      sqrtPrice
      tick
      liquidity
      token0 { id symbol decimals derivedETH name }
      token1 { id symbol decimals derivedETH name }
    }
  }
}
`

async function postGraphql(endpoint: string, query: string, owner: string): Promise<GqlPosition[]> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { owner: owner.toLowerCase() } }),
    cache: 'no-store',
  })
  const body = (await res.json()) as {
    data?: { positions?: GqlPosition[] }
    errors?: { message: string }[]
  }
  if (!res.ok) {
    throw new Error(`subgraph_http_${res.status}`)
  }
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join('; '))
  }
  return body.data?.positions ?? []
}

function buildSdkAmounts(pos: GqlPosition, sdkChainId: number): { amount0: number; amount1: number } {
  const p = pos.pool
  const d0 = Number(p.token0.decimals ?? '18')
  const d1 = Number(p.token1.decimals ?? '18')
  const t0 = new Token(
    sdkChainId,
    p.token0.id.toLowerCase(),
    Number.isFinite(d0) ? d0 : 18,
    p.token0.symbol ?? 'T0',
    p.token0.name ?? p.token0.symbol ?? 'Token0'
  )
  const t1 = new Token(
    sdkChainId,
    p.token1.id.toLowerCase(),
    Number.isFinite(d1) ? d1 : 18,
    p.token1.symbol ?? 'T1',
    p.token1.name ?? p.token1.symbol ?? 'Token1'
  )
  const fee = Number(p.feeTier)
  const sqrt = JSBI.BigInt(p.sqrtPrice)
  const liqPool = JSBI.BigInt(p.liquidity)
  const tickCurrent = Number(p.tick)
  const poolSdk = new Pool(t0, t1, fee, sqrt, liqPool, tickCurrent)
  const posLiq = JSBI.BigInt(pos.liquidity)
  const tl = tickIdx(pos.tickLower)
  const tu = tickIdx(pos.tickUpper)
  const positionSdk = new Position({
    pool: poolSdk,
    liquidity: posLiq,
    tickLower: tl,
    tickUpper: tu,
  })
  return {
    amount0: Number(positionSdk.amount0.toExact()),
    amount1: Number(positionSdk.amount1.toExact()),
  }
}

async function fetchFromSubgraph(
  ownerAddress: string,
  endpoint: string,
  liquidityChain: LiquidityChain,
): Promise<LiquidityPositionsResult> {
  let rows: GqlPosition[]
  try {
    rows = await postGraphql(endpoint, POSITIONS_QUERY_SCALAR_TICKS, ownerAddress)
  } catch {
    rows = await postGraphql(endpoint, POSITIONS_QUERY, ownerAddress)
  }

  const ethUsd = await fetchEthUsdSpot()
  const positions: LiquidityPosition[] = []

  for (const pos of rows) {
    if (!pos.liquidity || pos.liquidity === '0') continue
    const p = pos.pool
    const price0 = usdFromDerivedEth(p.token0.derivedETH, ethUsd)
    const price1 = usdFromDerivedEth(p.token1.derivedETH, ethUsd)

    let amount0: number
    let amount1: number
    try {
      ;({ amount0, amount1 } = buildSdkAmounts(pos, MAINNET_CHAIN_ID))
    } catch {
      continue
    }

    const dep0 = parseBd(pos.depositedToken0) - parseBd(pos.withdrawnToken0)
    const dep1 = parseBd(pos.depositedToken1) - parseBd(pos.withdrawnToken1)
    const fees0 = parseBd(pos.collectedFeesToken0)
    const fees1 = parseBd(pos.collectedFeesToken1)

    const investedUSD = Math.max(0, dep0) * price0 + Math.max(0, dep1) * price1
    const valueUSD = amount0 * price0 + amount1 * price1
    const feesEarnedUSD = fees0 * price0 + fees1 * price1
    const pnlUSD = calculatePnL({ valueUSD, investedUSD, feesEarnedUSD })
    const il = calculateImpermanentLoss({
      amountA: amount0,
      amountB: amount1,
      priceA_USD: price0,
      priceB_USD: price1,
      entryAmountA: Math.max(0, dep0),
      entryAmountB: Math.max(0, dep1),
      entryPriceA_USD: null,
      entryPriceB_USD: null,
    })

    const currentTick = Number(p.tick)
    const tl = tickIdx(pos.tickLower)
    const tu = tickIdx(pos.tickUpper)
    const inRange = currentTick >= tl && currentTick <= tu
    const d0 = Number(p.token0.decimals ?? '18')
    const d1 = Number(p.token1.decimals ?? '18')
    let tokenAValuePct: number
    if (valueUSD > 1e-8 && price0 > 0) {
      tokenAValuePct = Math.round(((amount0 * price0) / valueUSD) * 100)
    } else if (currentTick < tl) {
      tokenAValuePct = 100
    } else if (currentTick > tu) {
      tokenAValuePct = 0
    } else {
      tokenAValuePct = 50
    }

    positions.push({
      id: `eth-uni-v3-${pos.id}`,
      chain: liquidityChain,
      protocol: 'Uniswap v3',
      tokenA: p.token0.symbol ?? 'Token0',
      tokenB: p.token1.symbol ?? 'Token1',
      amountA: amount0,
      amountB: amount1,
      valueUSD,
      investedUSD,
      feesEarnedUSD,
      pnlUSD,
      pnlPct: pnlPercent(pnlUSD, investedUSD),
      impermanentLossUSD: il,
      poolAddress: p.id,
      feeTierBps: Number(p.feeTier),
      inRange,
      tickLower: tl,
      tickUpper: tu,
      currentTick,
      decimalsA: Number.isFinite(d0) ? d0 : 18,
      decimalsB: Number.isFinite(d1) ? d1 : 18,
      tokenAValuePct,
      positionKind: 'concentrated',
      raw: { positionId: pos.id },
    })
  }

  positions.sort((a, b) => b.valueUSD - a.valueUSD)

  const aprSeen = new Map<string, number | undefined>()
  for (const x of positions) {
    if (!x.poolAddress || x.feeTierBps == null) continue
    const k = `${x.poolAddress.toLowerCase()}-${x.feeTierBps}`
    if (!aprSeen.has(k)) {
      aprSeen.set(
        k,
        await estimateAprFromDexscreenerPool({
          chain: liquidityChain,
          poolAddress: x.poolAddress,
          feeTierBps: x.feeTierBps,
        }),
      )
    }
    x.estimatedAprPct = aprSeen.get(k)
  }

  return {
    positions,
    meta: {
      source: 'uniswap-v3-subgraph+sdk',
      warning:
        ethUsd <= 0
          ? 'Preço ETH (USD) indisponível; valores podem estar subestimados.'
          : undefined,
    },
  }
}

/**
 * Posições Uniswap v3:
 * — Ethereum (chainId 1): subgraph (THE_GRAPH_API_KEY / UNISWAP_V3_SUBGRAPH_URL) se configurado, senão RPC;
 * — Arbitrum, Base, Polygon: apenas RPC on-chain (mesmos contratos Uniswap v3).
 */
export async function getEthereumPositions(
  ownerAddress: string,
  chainId: number = MAINNET_CHAIN_ID,
): Promise<LiquidityPositionsResult> {
  if (!isSupportedEvmUniswapChainId(chainId)) {
    return {
      positions: [],
      meta: {
        source: 'uniswap-v3',
        warning:
          'Rede EVM não suportada para Uniswap v3 aqui. Suportadas: Ethereum, Arbitrum, Base, Polygon, BNB Chain.',
      },
    }
  }

  const liquidityChain = liquidityChainForUniswapEvm(chainId)

  if (chainId !== MAINNET_CHAIN_ID) {
    return getEthereumPositionsOnChain(ownerAddress, chainId)
  }

  const endpoint = subgraphEndpoint()
  if (endpoint) {
    try {
      return await fetchFromSubgraph(ownerAddress, endpoint, liquidityChain)
    } catch {
      /* continua para RPC */
    }
  }

  const onChain = await getEthereumPositionsOnChain(ownerAddress, chainId)
  if (!endpoint) {
    return onChain
  }

  return {
    ...onChain,
    meta: {
      ...onChain.meta,
      warning: [onChain.meta.warning, 'Subgraph indisponível; usado modo RPC.'].filter(Boolean).join(' '),
    },
  }
}
