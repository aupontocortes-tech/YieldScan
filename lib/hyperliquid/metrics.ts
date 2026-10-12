import type { ClosedTrade, PaperBook, PaperPosition } from '@/lib/hyperliquid/types'

export type PerformanceMetrics = {
  trades: number
  wins: number
  losses: number
  winRatePct: number
  avgWinUsd: number
  avgLossUsd: number
  payoffRatio: number
  maxDrawdownPct: number
  feesUsd: number
  slippageUsd: number
  netUsd: number
  grossUsd: number
}

export function markToMarket(cashUsd: number, positions: PaperPosition[], priceOf: (symbol: PaperPosition['symbol']) => number): number {
  let equity = cashUsd
  for (const pos of positions) {
    const px = priceOf(pos.symbol)
    equity += pos.qty * px
  }
  return equity
}

export function computeMetrics(trades: ClosedTrade[], equityCurve: number[]): PerformanceMetrics {
  const wins = trades.filter((t) => t.netUsd > 0)
  const losses = trades.filter((t) => t.netUsd <= 0)
  const avgWinUsd = wins.length ? wins.reduce((s, t) => s + t.netUsd, 0) / wins.length : 0
  const avgLossUsd = losses.length ? Math.abs(losses.reduce((s, t) => s + t.netUsd, 0) / losses.length) : 0
  let peak = equityCurve[0] ?? 0
  let maxDd = 0
  for (const v of equityCurve) {
    if (v > peak) peak = v
    if (peak > 0) maxDd = Math.max(maxDd, (peak - v) / peak)
  }
  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRatePct: trades.length ? (wins.length / trades.length) * 100 : 0,
    avgWinUsd,
    avgLossUsd,
    payoffRatio: avgLossUsd > 0 ? avgWinUsd / avgLossUsd : avgWinUsd > 0 ? Infinity : 0,
    maxDrawdownPct: maxDd * 100,
    feesUsd: trades.reduce((s, t) => s + t.feesUsd, 0),
    slippageUsd: trades.reduce((s, t) => s + t.slippageUsd, 0),
    netUsd: trades.reduce((s, t) => s + t.netUsd, 0),
    grossUsd: trades.reduce((s, t) => s + t.pnlUsd, 0),
  }
}

export function equityFromBook(book: PaperBook, priceOf: (symbol: PaperPosition['symbol']) => number): number {
  return markToMarket(book.cashUsd, book.positions, priceOf)
}
