export type BinanceInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M'

export type MaType = 'SMA' | 'EMA'

export type MaConfig = {
  id: string
  period: number
  type: MaType
  color: string
}

export type RsiSettings = {
  enabled: boolean
  period: number
  oversold: number
  overbought: number
  showLevels: boolean
}

export type MacdSettings = {
  enabled: boolean
  fast: number
  slow: number
  signal: number
}

export type StochSettings = {
  enabled: boolean
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

export type ZonesSettings = {
  enabled: boolean
  showMaZones: boolean
  showSupportResistance: boolean
  showSmartMultipliers: boolean
}

export type OhlcvBar = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type TimeframePreset = {
  id: string
  label: string
  interval: BinanceInterval
  limit: number
  group: 'intra' | 'swing' | 'periodo'
}

export const TIMEFRAME_PRESETS: TimeframePreset[] = [
  // Intraday candles
  { id: '1m',  label: '1m',   interval: '1m',  limit: 500, group: 'intra' },
  { id: '5m',  label: '5m',   interval: '5m',  limit: 500, group: 'intra' },
  { id: '15m', label: '15m',  interval: '15m', limit: 500, group: 'intra' },
  { id: '1h',  label: '1h',   interval: '1h',  limit: 500, group: 'intra' },
  { id: '4h',  label: '4h',   interval: '4h',  limit: 500, group: 'intra' },
  // Multi-day candles
  { id: '1d',  label: '1d',   interval: '1d',  limit: 500, group: 'swing' },
  { id: '1w',  label: '1sem', interval: '1w',  limit: 200, group: 'swing' },
  { id: '1M',  label: '1mes', interval: '1M',  limit: 60,  group: 'swing' },
  // Period presets (fixed time window using daily/weekly candles)
  { id: '2mo', label: '2M',   interval: '1d',  limit: 60,  group: 'periodo' },
  { id: '3mo', label: '3M',   interval: '1d',  limit: 90,  group: 'periodo' },
  { id: '6mo', label: '6M',   interval: '1d',  limit: 180, group: 'periodo' },
  { id: '1y',  label: '1A',   interval: '1d',  limit: 365, group: 'periodo' },
  { id: '3y',  label: '3A',   interval: '1w',  limit: 156, group: 'periodo' },
]

/** @deprecated Use TIMEFRAME_PRESETS */
export const BINANCE_INTERVALS = TIMEFRAME_PRESETS.filter(t => t.group !== 'periodo').map(t => ({
  value: t.interval,
  label: t.label,
}))
