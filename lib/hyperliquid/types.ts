export type HlSymbol = 'BTC' | 'ETH' | 'SOL' | 'HYPE'

export type HlTimeframe = '15m' | '1h' | '4h' | '1d'

export type HlBar = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type HlSide = 'long'

export type HlSignal = 'buy' | 'sell' | 'none'

export type NewsRisk = 'baixo' | 'medio' | 'alto'

export type SignalDecision = {
  signal: HlSignal
  reason: string
  entry: number | null
  stop: number | null
  takeProfit: number | null
  sizeUsd: number
  blocked: boolean
  blockReason: string | null
}

export type RuleParams = {
  id: string
  rsiMin: number
  rsiMax: number
  atrStopMult: number
  atrTpMult: number
  requireBtcFilter: boolean
  blockHighNews: boolean
}

export type TradeFeatures = {
  symbol: HlSymbol
  rsi: number
  macdHist: number
  ema9Above21: boolean
  aboveEma200: boolean
  btcTrendUp: boolean
  newsRisk: NewsRisk
  oracleDivergence: number
  closeAboveOpen: boolean
}

export type TrainingSample = {
  id: string
  at: number
  source: 'paper' | 'replay'
  features: TradeFeatures
  entry: number
  atr: number
  pathHigh: number[]
  pathLow: number[]
  pathClose: number[]
  realized: boolean
  win: boolean
  netUsd: number
}

export type TrainReport = {
  at: number
  samples: number
  trainWinPct: number
  holdoutWinPct: number
  holdoutNetUsd: number
  activeHoldoutWinPct: number
  activeHoldoutNetUsd: number
  approved: boolean
  reason: string
  candidate: RuleParams | null
}

export type PaperPosition = {
  id: string
  symbol: HlSymbol
  side: HlSide
  entry: number
  stop: number
  takeProfit: number
  sizeUsd: number
  qty: number
  openedAt: number
  reason: string
  feesUsd: number
  features?: TradeFeatures
  atr?: number
}

export type PaperOrder = {
  id: string
  symbol: HlSymbol
  side: 'buy' | 'sell'
  type: 'market' | 'stop' | 'take-profit'
  status: 'filled' | 'cancelled' | 'open'
  price: number
  sizeUsd: number
  createdAt: number
  reason: string
}

export type ClosedTrade = {
  id: string
  symbol: HlSymbol
  side: HlSide
  entry: number
  exit: number
  sizeUsd: number
  pnlUsd: number
  feesUsd: number
  slippageUsd: number
  netUsd: number
  openedAt: number
  closedAt: number
  entryReason: string
  exitReason: string
  rMultiple: number
}

export type BotLog = {
  at: number
  level: 'info' | 'warn' | 'error'
  message: string
}

export type PaperBook = {
  rulesVersion: string
  rules: RuleParams
  cashUsd: number
  dayKey: string
  dayStartEquity: number
  robotOn: boolean
  haltedReason: string | null
  consecutiveErrors: number
  positions: PaperPosition[]
  orders: PaperOrder[]
  trades: ClosedTrade[]
  logs: BotLog[]
  samples: TrainingSample[]
  pending: TrainReport | null
}
