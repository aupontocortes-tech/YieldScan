import { DEFAULT_SIGNAL_PARAMS, OPTIMIZATION_MIN_TRADES } from '@/lib/btc/signal-system/constants'
import type { SignalEngineParams, SignalOptimizationContext, SignalOptimizationResult } from '@/lib/btc/signal-system/types'
import { runSignalBacktest } from '@/lib/btc/signal-system/engine'

type GridOption<T> = T[]

function grid(): SignalEngineParams[] {
  const adxMins: GridOption<number> = [20, 22]
  const minScores: GridOption<number> = [52, 56]
  const minConfluences: GridOption<number> = [7, 8]
  const macdSets: GridOption<Pick<SignalEngineParams, 'macdFast' | 'macdSlow'>> = [
    { macdFast: 12, macdSlow: 26 },
    { macdFast: 8, macdSlow: 21 },
  ]
  // Relação alvo/risco — o fator que mais decide a lucratividade.
  const tpSlSets: GridOption<Pick<SignalEngineParams, 'tpAtrMult' | 'slAtrMult'>> = [
    { tpAtrMult: 2, slAtrMult: 1.2 },
    { tpAtrMult: 2.5, slAtrMult: 1.3 },
    { tpAtrMult: 3, slAtrMult: 1.5 },
  ]

  const out: SignalEngineParams[] = []
  for (const adxMin of adxMins) {
    for (const signalMinScore of minScores) {
      for (const minConfluence of minConfluences) {
        for (const macd of macdSets) {
          for (const tpSl of tpSlSets) {
            out.push({
              ...DEFAULT_SIGNAL_PARAMS,
              adxMin,
              signalMinScore,
              minConfluence,
              ...macd,
              ...tpSl,
            })
          }
        }
      }
    }
  }
  return out
}

/**
 * Objetivo: LUCRO robusto, não uma % de acerto arbitrária.
 * (Alto acerto com perda líquida é a armadilha clássica que queremos evitar.)
 */
function rankResult(
  winRatePct: number,
  total: number,
  cumulativeProfitPct: number,
  maxDrawdownPct: number,
): number {
  if (total < 6) return -Infinity
  const profit = cumulativeProfitPct
  const ddPenalty = maxDrawdownPct * 0.4
  const tradeBonus = Math.min(15, total) * 0.6
  const winBonus = (winRatePct - 50) * 0.4
  return profit - ddPenalty + tradeBonus + winBonus
}

/**
 * Grid search leve que escolhe os parâmetros mais LUCRATIVOS e robustos
 * (não os de maior % de acerto). Roda no cliente ao ativar o Radar.
 */
export function optimizeSignalParams(ctx: SignalOptimizationContext): SignalOptimizationResult {
  const candidates = grid()
  let best: SignalOptimizationResult | null = null

  for (const params of candidates) {
    const backtest = runSignalBacktest(ctx.bars, ctx.htfBars, params, ctx.chartLabel)
    if (backtest.total < 6) continue

    const score = rankResult(
      backtest.winRatePct,
      backtest.total,
      backtest.cumulativeProfitPct,
      backtest.maxDrawdownPct,
    )
    if (!Number.isFinite(score)) continue

    // "Meta atingida" = lucrativo, com acerto decente e amostra suficiente.
    const targetMet =
      backtest.cumulativeProfitPct > 0 &&
      backtest.winRatePct >= 50 &&
      backtest.total >= OPTIMIZATION_MIN_TRADES

    const entry: SignalOptimizationResult = {
      params,
      backtest,
      targetMet,
      score,
    }

    if (!best || entry.score > best.score) best = entry
  }

  if (!best) {
    const backtest = runSignalBacktest(ctx.bars, ctx.htfBars, DEFAULT_SIGNAL_PARAMS, ctx.chartLabel)
    return {
      params: DEFAULT_SIGNAL_PARAMS,
      backtest,
      targetMet: backtest.cumulativeProfitPct > 0 && backtest.winRatePct >= 50,
      score: 0,
    }
  }

  return best
}
