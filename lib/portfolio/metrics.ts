import type { CmcQuote, PortfolioHolding } from './types'

export type HoldingRowMetrics = {
  price: number
  valueUsd: number
  costUsd: number
  pnlUsd: number
  pnlPct: number
  pct24h: number
  pct7d: number
}

export function rowMetrics(
  h: PortfolioHolding,
  quote: CmcQuote | undefined,
): HoldingRowMetrics {
  const price = quote?.price ?? 0
  const valueUsd = h.quantity * price
  const costUsd = h.quantity * h.avgBuyUsd
  const pnlUsd = valueUsd - costUsd
  const pnlPct = costUsd > 0 ? (pnlUsd / costUsd) * 100 : 0
  return {
    price,
    valueUsd,
    costUsd,
    pnlUsd,
    pnlPct,
    pct24h: quote?.pct24h ?? 0,
    pct7d: quote?.pct7d ?? 0,
  }
}

export function totalsFromHoldings(
  holdings: PortfolioHolding[],
  prices: Record<string, CmcQuote>,
  realizedPnlUsd: number,
) {
  let valueUsd = 0
  let costUsd = 0
  for (const h of holdings) {
    const q = prices[h.symbol]
    const m = rowMetrics(h, q)
    valueUsd += m.valueUsd
    costUsd += m.costUsd
  }
  const unrealized = valueUsd - costUsd
  const totalPnlUsd = unrealized + realizedPnlUsd
  const totalPnlPct = costUsd > 0 ? (totalPnlUsd / costUsd) * 100 : 0
  return {
    valueUsd,
    costUsd,
    unrealizedPnlUsd: unrealized,
    totalPnlUsd,
    totalPnlPct,
    realizedPnlUsd,
  }
}
