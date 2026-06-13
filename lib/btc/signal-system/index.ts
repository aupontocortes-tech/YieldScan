import type { OhlcvBar } from '@/lib/btc/types'
import { DEFAULT_SIGNAL_PARAMS } from '@/lib/btc/signal-system/constants'
import { optimizeSignalParams } from '@/lib/btc/signal-system/optimizer'
import type { SignalBacktestResult, SignalEngineParams } from '@/lib/btc/signal-system/types'
import { computeTrendRadar, type TrendRadarAnalysis } from '@/lib/btc/trend-radar'

export type { SignalBacktestResult, SignalEngineParams, SignalOptimizationResult } from '@/lib/btc/signal-system/types'
export { DEFAULT_SIGNAL_PARAMS, OPTIMIZATION_TARGET_WIN_RATE } from '@/lib/btc/signal-system/constants'
export { optimizeSignalParams } from '@/lib/btc/signal-system/optimizer'
export { tpSlFromAtr, buildBacktestFromTrades } from '@/lib/btc/signal-system/backtest'

export { runSignalBacktest } from '@/lib/btc/signal-system/engine'

/** Mínimo de velas para validar fora da amostra (caso contrário a janela de teste fica vazia). */
const OUT_OF_SAMPLE_MIN_BARS = 120
/** Treina em metade do histórico e valida na outra metade — mais operações no teste = número fiável. */
const TRAIN_SPLIT = 0.5

/** Análise completa com otimização automática + validação fora da amostra. */
export function computeOptimizedBtcSignals(
  bars: OhlcvBar[],
  htfBars: OhlcvBar[] | undefined,
  options: { chartLabel: string; htfLabel?: string; optimize?: boolean },
): TrendRadarAnalysis | null {
  if (options.optimize !== false && bars.length >= OUT_OF_SAMPLE_MIN_BARS) {
    // Treina os parâmetros só na 1ª metade do histórico (in-sample)...
    const split = Math.floor(bars.length * TRAIN_SPLIT)
    const trainBars = bars.slice(0, split)
    const opt = optimizeSignalParams({ bars: trainBars, htfBars, chartLabel: options.chartLabel })
    // ...e mede a taxa de acerto só no período seguinte, nunca visto (out-of-sample).
    const oos = computeTrendRadar(bars, htfBars, {
      chartLabel: options.chartLabel,
      htfLabel: options.htfLabel,
      params: opt.params,
      optimization: opt,
      backtestStartIndex: split,
    })
    // Amostra pequena demais → usa histórico completo (número estatisticamente fiável).
    if (oos && oos.backtest.total >= 10) return oos
    return computeTrendRadar(bars, htfBars, {
      chartLabel: options.chartLabel,
      htfLabel: options.htfLabel,
      params: opt.params,
      optimization: opt,
    })
  }

  if (options.optimize !== false && bars.length >= 80) {
    const opt = optimizeSignalParams({ bars, htfBars, chartLabel: options.chartLabel })
    return computeTrendRadar(bars, htfBars, {
      chartLabel: options.chartLabel,
      htfLabel: options.htfLabel,
      params: opt.params,
      optimization: opt,
    })
  }

  return computeTrendRadar(bars, htfBars, {
    chartLabel: options.chartLabel,
    htfLabel: options.htfLabel,
    params: DEFAULT_SIGNAL_PARAMS,
  })
}
