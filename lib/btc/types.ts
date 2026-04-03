export type BinanceInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M'

export type MaType = 'SMA' | 'EMA'

export type MaConfig = {
  id: string
  period: number
  type: MaType
  color: string
}

export type RsiSettings = {
  period: number
  oversold: number
  overbought: number
  showLevels: boolean
}

export type MacdSettings = {
  fast: number
  slow: number
  signal: number
}

export type StochSettings = {
  kPeriod: number
  dPeriod: number
  smooth: number
}

export type BollingerSettings = {
  enabled: boolean
  period: number
  stdDev: number
  showUpper: boolean
  showMiddle: boolean
  showLower: boolean
}

export type OhlcvBar = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export const BINANCE_INTERVALS: { value: BinanceInterval; label: string }[] = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
  { value: '1w', label: '1w' },
  { value: '1M', label: '1M' },
]
