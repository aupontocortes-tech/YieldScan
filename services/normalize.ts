import type { LiquidityPosition } from '@/lib/liquidity/types'
import type { AggregatorLiquidityPosition, AggregatorRange } from '@/services/types'

function tickToHumanPrice(tick: number, d0: number, d1: number): number {
  return Math.pow(1.0001, tick) * Math.pow(10, d0 - d1)
}

function chainLabel(chain: LiquidityPosition['chain']): string {
  const m: Record<LiquidityPosition['chain'], string> = {
    ethereum: 'Ethereum',
    arbitrum: 'Arbitrum',
    base: 'Base',
    polygon: 'Polygon',
    bnb: 'BNB Chain',
    solana: 'Solana',
  }
  return m[chain] ?? String(chain)
}

function buildRangeFromTicks(p: LiquidityPosition): AggregatorRange {
  const d0 = p.decimalsA ?? 18
  const d1 = p.decimalsB ?? 18
  const tl = p.tickLower
  const tu = p.tickUpper
  const tc = p.currentTick

  if (
    tl == null ||
    tu == null ||
    tc == null ||
    !Number.isFinite(tl) ||
    !Number.isFinite(tu) ||
    !Number.isFinite(tc)
  ) {
    return { min: 0, max: 1, current: 0.5, percentage: 50 }
  }

  const min = tickToHumanPrice(tl, d0, d1)
  const max = tickToHumanPrice(tu, d0, d1)
  const current = tickToHumanPrice(tc, d0, d1)
  const span = tu - tl
  const percentage = span !== 0 ? ((tc - tl) / span) * 100 : 50

  return {
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
    current: Number.isFinite(current) ? current : 0,
    percentage: Number.isFinite(percentage) ? percentage : 50,
  }
}

function buildRangeForLpToken(p: LiquidityPosition): AggregatorRange {
  const pct = p.tokenAValuePct ?? 50
  return {
    min: 0,
    max: 100,
    current: pct,
    percentage: pct,
  }
}

/**
 * Converte o modelo interno (RPC / DexScreener) para o modelo do agregador.
 */
export function normalizePosition(p: LiquidityPosition): AggregatorLiquidityPosition {
  const isConcentrated = p.positionKind === 'concentrated' && p.tickLower != null
  const range = isConcentrated ? buildRangeFromTicks(p) : buildRangeForLpToken(p)

  const v = Math.max(0, Number.isFinite(p.valueUSD) ? p.valueUSD : 0)
  const pctA = Math.max(0, Math.min(100, p.tokenAValuePct ?? (v > 0 ? 50 : 0)))
  const usd0 = v * (pctA / 100)
  const usd1 = Math.max(0, v - usd0)

  const amt0 = Number.isFinite(p.amountA) ? p.amountA : 0
  const amt1 = Number.isFinite(p.amountB) ? p.amountB : 0

  const inRange =
    p.inRange ??
    (isConcentrated && p.tickLower != null && p.tickUpper != null && p.currentTick != null
      ? p.currentTick >= p.tickLower && p.currentTick <= p.tickUpper
      : true)

  const rawMeta = p.raw as { unindexedClmmNft?: boolean } | undefined
  const unpricedPlaceholder = Boolean(rawMeta?.unindexedClmmNft)

  return {
    id: p.id,
    chain: chainLabel(p.chain),
    protocol: p.protocol,
    token0: {
      symbol: p.tokenA,
      amount: amt0,
      usdValue: usd0,
    },
    token1: {
      symbol: p.tokenB,
      amount: amt1,
      usdValue: usd1,
    },
    totalValueUSD: v,
    feesUSD: Math.max(0, Number.isFinite(p.feesEarnedUSD) ? p.feesEarnedUSD : 0),
    apr: Math.max(0, p.estimatedAprPct ?? 0),
    inRange,
    range,
    pnlPct: Number.isFinite(p.pnlPct) ? p.pnlPct : undefined,
    impermanentLossUSD: p.impermanentLossUSD ?? undefined,
    poolAddress: p.poolAddress,
    feeTierBps: p.feeTierBps,
    unpricedPlaceholder,
  }
}

export function normalizePositions(positions: LiquidityPosition[]): AggregatorLiquidityPosition[] {
  return positions
    .filter((p) => {
      const raw = p.raw as { unindexedClmmNft?: boolean } | undefined
      if (raw?.unindexedClmmNft) return true
      const v = Number.isFinite(p.valueUSD) ? p.valueUSD : 0
      const f = Number.isFinite(p.feesEarnedUSD) ? p.feesEarnedUSD : 0
      if (v > 0 || f > 0) return true
      return false
    })
    .map(normalizePosition)
}
