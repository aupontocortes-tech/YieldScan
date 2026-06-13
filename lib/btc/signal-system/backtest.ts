import type { SignalBacktestResult, SignalBacktestTrade, SignalEngineParams } from '@/lib/btc/signal-system/types'
import type { TrendRadarMarker } from '@/lib/btc/trend-radar'

export function evaluateTradePnl(
  entry: number,
  exit: number,
  type: 'buy' | 'sell',
): number {
  if (entry <= 0) return 0
  return type === 'buy' ? ((exit - entry) / entry) * 100 : ((entry - exit) / entry) * 100
}

export function buildBacktestFromTrades(
  trades: SignalBacktestTrade[],
  horizonBars: number,
  chartBars: number,
): SignalBacktestResult {
  const wins = trades.filter((t) => t.outcome === 'win').length
  const losses = trades.length - wins
  const total = trades.length
  const winRatePct = total > 0 ? Math.round((wins / total) * 100) : 0

  let equity = 100
  let peak = 100
  let maxDrawdownPct = 0
  let cumulativeProfitPct = 0

  for (const t of trades) {
    cumulativeProfitPct += t.pnlPct
    equity *= 1 + t.pnlPct / 100
    if (equity > peak) peak = equity
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0
    if (dd > maxDrawdownPct) maxDrawdownPct = dd
  }

  return {
    winRatePct,
    wins,
    losses,
    total,
    cumulativeProfitPct: Math.round(cumulativeProfitPct * 10) / 10,
    maxDrawdownPct: Math.round(maxDrawdownPct * 10) / 10,
    horizonBars,
    chartBars,
    trades,
  }
}

export function mergeMarkerBacktest(
  markers: TrendRadarMarker[],
  tradeOutcomes: Array<{ time: number; outcome: 'win' | 'loss'; pnlPct: number; exitPrice: number }>,
  horizonBars: number,
  chartBars: number,
): SignalBacktestResult {
  const trades: SignalBacktestTrade[] = markers.map((mk, i) => {
    const o = tradeOutcomes[i]
    return {
      type: mk.type,
      entryIndex: i,
      entryPrice: mk.price,
      exitPrice: o?.exitPrice ?? mk.price,
      pnlPct: o?.pnlPct ?? 0,
      outcome: o?.outcome ?? 'loss',
    }
  })
  return buildBacktestFromTrades(trades, horizonBars, chartBars)
}

export function tpSlFromAtr(
  price: number,
  atr: number,
  type: 'buy' | 'sell',
  params: SignalEngineParams,
): { takeProfit: number; stopLoss: number } {
  const a = atr > 0 ? atr : price * 0.02
  if (type === 'buy') {
    return {
      takeProfit: price + a * params.tpAtrMult,
      stopLoss: price - a * params.slAtrMult,
    }
  }
  return {
    takeProfit: price - a * params.tpAtrMult,
    stopLoss: price + a * params.slAtrMult,
  }
}
