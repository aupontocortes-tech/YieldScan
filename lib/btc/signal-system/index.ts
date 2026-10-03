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
    // Treina na 1ª metade; valida na 2ª (fora da amostra).
    const split = Math.floor(bars.length * TRAIN_SPLIT)
    const trainBars = bars.slice(0, split)
    const opt = optimizeSignalParams({ bars: trainBars, htfBars, chartLabel: options.chartLabel })

    const withOpt = computeTrendRadar(bars, htfBars, {
      chartLabel: options.chartLabel,
      htfLabel: options.htfLabel,
      params: opt.params,
      optimization: opt,
      backtestStartIndex: split,
    })
    const withDefault = computeTrendRadar(bars, htfBars, {
      chartLabel: options.chartLabel,
      htfLabel: options.htfLabel,
      params: DEFAULT_SIGNAL_PARAMS,
      optimization: opt,
      backtestStartIndex: split,
    })

    // Escolhe o set com melhor acerto OOS (e lucro ≥ 0); evita overfit do grid.
    const pickBetter = (
      a: TrendRadarAnalysis | null,
      b: TrendRadarAnalysis | null,
    ): TrendRadarAnalysis | null => {
      if (!a) return b
      if (!b) return a
      const aOk = a.backtest.cumulativeProfitPct >= 0
      const bOk = b.backtest.cumulativeProfitPct >= 0
      if (aOk && !bOk) return a
      if (bOk && !aOk) return b
      if (a.backtest.winRatePct !== b.backtest.winRatePct) {
        return a.backtest.winRatePct >= b.backtest.winRatePct ? a : b
      }
      return a.backtest.cumulativeProfitPct >= b.backtest.cumulativeProfitPct ? a : b
    }

    const oosWinner = pickBetter(withOpt, withDefault)
    const params =
      oosWinner && oosWinner === withDefault ? DEFAULT_SIGNAL_PARAMS : opt.params

    // Histórico completo com os params que ganharam no teste OOS (painel estável).
    return computeTrendRadar(bars, htfBars, {
      chartLabel: options.chartLabel,
      htfLabel: options.htfLabel,
      params,
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
