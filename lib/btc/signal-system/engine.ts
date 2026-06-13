import { buildBacktestFromTrades } from '@/lib/btc/signal-system/backtest'
import type { SignalBacktestResult, SignalEngineParams } from '@/lib/btc/signal-system/types'
import type { OhlcvBar } from '@/lib/btc/types'
import { computeTrendRadar } from '@/lib/btc/trend-radar'

/** Backtest leve sem otimização — usado pelo grid search. */
export function runSignalBacktest(
  bars: OhlcvBar[],
  htfBars: OhlcvBar[] | undefined,
  params: SignalEngineParams,
  chartLabel: string,
): SignalBacktestResult {
  const analysis = computeTrendRadar(bars, htfBars, {
    chartLabel,
    params,
    skipMarkersLimit: true,
  })
  if (!analysis) {
    return buildBacktestFromTrades([], 0, bars.length)
  }
  return analysis.backtest
}
