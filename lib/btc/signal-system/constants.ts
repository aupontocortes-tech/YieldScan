import type { SignalEngineParams } from '@/lib/btc/signal-system/types'

/** Parâmetros padrão — selectivos: bounce/HTF + TP mais próximo para subir acerto. */
export const DEFAULT_SIGNAL_PARAMS: SignalEngineParams = {
  rsiPeriod: 14,
  adxPeriod: 14,
  adxMin: 22,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  emaFast: 20,
  emaSlow: 50,
  emaLong: 200,
  atrPeriod: 14,
  pocLookback: 60,
  vwapLookback: 50,
  volumeSmaPeriod: 20,
  signalMinScore: 62,
  signalStrongScore: 72,
  signalScoreGap: 10,
  minConfluence: 8,
  minCoreConfluence: 4,
  minSignalGapBars: 10,
  /** TP curto + SL um pouco mais largo → mais acertos sem matar o trade cedo. */
  tpAtrMult: 1.6,
  slAtrMult: 1.35,
}

export const OPTIMIZATION_TARGET_WIN_RATE = 68
export const OPTIMIZATION_MIN_TRADES = 6

/** Custo total por operação (entrada + saída): taxa + slippage estimados. */
export const ROUND_TRIP_COST_PCT = 0.2
