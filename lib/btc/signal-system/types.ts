import type { OhlcvBar } from '@/lib/btc/types'

/** Parâmetros otimizáveis do motor de sinais BTC. */
export type SignalEngineParams = {
  rsiPeriod: number
  adxPeriod: number
  adxMin: number
  macdFast: number
  macdSlow: number
  macdSignal: number
  emaFast: number
  emaSlow: number
  emaLong: number
  atrPeriod: number
  pocLookback: number
  vwapLookback: number
  volumeSmaPeriod: number
  signalMinScore: number
  signalStrongScore: number
  signalScoreGap: number
  minConfluence: number
  minCoreConfluence: number
  minSignalGapBars: number
  tpAtrMult: number
  slAtrMult: number
}

export type SignalBacktestTrade = {
  type: 'buy' | 'sell'
  entryIndex: number
  entryPrice: number
  exitPrice: number
  pnlPct: number
  outcome: 'win' | 'loss'
}

export type SignalBacktestResult = {
  winRatePct: number
  wins: number
  losses: number
  total: number
  cumulativeProfitPct: number
  maxDrawdownPct: number
  horizonBars: number
  chartBars: number
  trades: SignalBacktestTrade[]
}

export type SignalOptimizationResult = {
  params: SignalEngineParams
  backtest: SignalBacktestResult
  targetMet: boolean
  score: number
}

export type SignalOptimizationContext = {
  bars: OhlcvBar[]
  htfBars?: OhlcvBar[]
  chartLabel: string
}
