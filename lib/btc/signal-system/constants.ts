import type { SignalEngineParams } from '@/lib/btc/signal-system/types'

/** Parâmetros padrão — mais selectivos (menos sinais fracos / mais perto do acerto). */
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
  signalMinScore: 60,
  signalStrongScore: 70,
  signalScoreGap: 10,
  minConfluence: 8,
  minCoreConfluence: 4,
  minSignalGapBars: 12,
  tpAtrMult: 2.5,
  slAtrMult: 1.3,
}

export const OPTIMIZATION_TARGET_WIN_RATE = 68
export const OPTIMIZATION_MIN_TRADES = 6

/** Custo total por operação (entrada + saída): taxa + slippage estimados. */
export const ROUND_TRIP_COST_PCT = 0.2
