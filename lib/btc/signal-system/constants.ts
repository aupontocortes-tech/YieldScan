import type { SignalEngineParams } from '@/lib/btc/signal-system/types'

/** Parâmetros padrão calibrados para BTC swing (timeframes médios/altos). */
export const DEFAULT_SIGNAL_PARAMS: SignalEngineParams = {
  rsiPeriod: 14,
  adxPeriod: 14,
  adxMin: 20,
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
  signalMinScore: 52,
  signalStrongScore: 64,
  signalScoreGap: 8,
  minConfluence: 7,
  minCoreConfluence: 3,
  minSignalGapBars: 6,
  tpAtrMult: 2,
  slAtrMult: 1.2,
}

export const OPTIMIZATION_TARGET_WIN_RATE = 68
export const OPTIMIZATION_MIN_TRADES = 8

/** Custo total por operação (entrada + saída): taxa + slippage estimados. */
export const ROUND_TRIP_COST_PCT = 0.2
