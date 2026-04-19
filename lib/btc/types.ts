export type BinanceInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M'

export type MaType = 'SMA' | 'EMA'

export type MaConfig = {
  id: string
  period: number
  type: MaType
  color: string
  lineWidth: 1 | 2 | 3
}

/** Cores das velas no gráfico principal (Lightweight Charts) */
export type CandlestickSettings = {
  colors: {
    /** Vela de alta: corpo, borda e pavio */
    up: string
    /** Vela de baixa: corpo e borda */
    down: string
    /** Pavio da vela de baixa (só o pavio; por defeito um vermelho um pouco mais claro) */
    wickDown: string
  }
}

/** `panel` = gráfico dedicado; `overlay` = sobre o preço (só faz sentido para alguns). */
export type IndicatorViewMode = 'panel' | 'overlay'

export type RsiSettings = {
  enabled: boolean
  period: number
  oversold: number
  overbought: number
  showLevels: boolean
  view: IndicatorViewMode
  lineWidth: 1 | 2 | 3
  colors: { line: string; oversold: string; overbought: string }
}

export type MacdSettings = {
  enabled: boolean
  fast: number
  slow: number
  signal: number
  view: IndicatorViewMode
  lineWidth: 1 | 2 | 3
  colors: { line: string; signal: string }
}

export type StochSettings = {
  enabled: boolean
  kPeriod: number
  dPeriod: number
  smooth: number
  view: IndicatorViewMode
  lineWidth: 1 | 2 | 3
  colors: { k: string; d: string }
}

export type BollingerSettings = {
  enabled: boolean
  period: number
  stdDev: number
  showUpper: boolean
  showMiddle: boolean
  showLower: boolean
  lineWidth: 1 | 2 | 3
  colors: { upper: string; middle: string; lower: string }
}

export type OnChainLineSettings = {
  enabled: boolean
  color: string
  lineWidth: 1 | 2 | 3
  style: 'line' | 'area'
}

export type MvrvSettings = OnChainLineSettings & {
  smaPeriod: number
}

export type MvrvZSettings = OnChainLineSettings & {
  window: number
}

export type SoprSettings = OnChainLineSettings & {
  emaPeriod: number
}

export type NuplSettings = OnChainLineSettings & {
  smaPeriod: number
}

export type SthLthSettings = {
  enabled: boolean
  rsiPeriod: number
  smaPeriod: number
  lineWidth: 1 | 2 | 3
  colorSth: string
  colorLth: string
}

export type OnChainBundle = {
  mvrv: MvrvSettings
  mvrvZ: MvrvZSettings
  sopr: SoprSettings
  nupl: NuplSettings
  sthLth: SthLthSettings
}

export type ZonesSettings = {
  enabled: boolean
  showMaZones: boolean
  showSupportResistance: boolean
  showSmartMultipliers: boolean
}

/** Bull Market Support Band (estilo TradingView): SMA 20 semanas + EMA 21 semanas em fechos semanais. */
export type BullMarketSupportBandSettings = {
  enabled: boolean
  lineWidth: 1 | 2 | 3
  colorSma: string
  colorEma: string
}

/** Períodos fixos (velas 1w) — iguais ao script popular zkdev / TradingView. */
export const BULL_MARKET_BAND_SMA_WEEKS = 20
export const BULL_MARKET_BAND_EMA_WEEKS = 21

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

/** Rótulos compactos e consistentes: m = minutos, h = horas, d = dia, w = semana, mo = mês, y = ano (1mo ≠ 1m). */
export const TIMEFRAME_PRESETS: TimeframePreset[] = [
  // Intraday candles
  { id: '1m',  label: '1m',   interval: '1m',  limit: 500, group: 'intra' },
  { id: '5m',  label: '5m',   interval: '5m',  limit: 500, group: 'intra' },
  { id: '15m', label: '15m',  interval: '15m', limit: 500, group: 'intra' },
  { id: '1h',  label: '1h',   interval: '1h',  limit: 500, group: 'intra' },
  { id: '4h',  label: '4h',   interval: '4h',  limit: 500, group: 'intra' },
  // Multi-day candles
  { id: '1d',  label: '1d',   interval: '1d',  limit: 500, group: 'swing' },
  { id: '1w',  label: '1w',   interval: '1w',  limit: 200, group: 'swing' },
  { id: '1M',  label: '1mo',  interval: '1M',  limit: 60,  group: 'swing' },
  // Period presets (fixed time window using daily/weekly candles)
  { id: '2mo', label: '2mo',  interval: '1d',  limit: 60,  group: 'periodo' },
  { id: '3mo', label: '3mo',  interval: '1d',  limit: 90,  group: 'periodo' },
  { id: '6mo', label: '6mo',  interval: '1d',  limit: 180, group: 'periodo' },
  { id: '1y',  label: '1y',   interval: '1d',  limit: 365, group: 'periodo' },
  { id: '3y',  label: '3y',   interval: '1w',  limit: 156, group: 'periodo' },
]

/** Texto para tooltip na barra de tempo (minuto ≠ mês). */
export const TIMEFRAME_TOOLTIP_PT: Record<string, string> = {
  '1m': '1 minuto por vela',
  '5m': '5 minutos por vela',
  '15m': '15 minutos por vela',
  '1h': '1 hora por vela',
  '4h': '4 horas por vela',
  '1d': '1 dia por vela',
  '1w': '1 semana por vela',
  '1M': '1 mês por vela (mensal)',
  '2mo': 'Janela ~2 meses (fechos diários)',
  '3mo': 'Janela ~3 meses (fechos diários)',
  '6mo': 'Janela ~6 meses (fechos diários)',
  '1y': 'Janela ~1 ano (fechos diários)',
  '3y': 'Janela ~3 anos (fechos semanais)',
}

/**
 * Barra principal do dashboard de indicadores (ordem fixa).
 * Inclui minutos → horas → dia / semana / mês → janelas (2m–3a).
 */
export const INDICATOR_TOOLBAR_TIMEFRAMES = [
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
  '1d',
  '1w',
  '1M',
  '2mo',
  '3mo',
  '6mo',
  '1y',
  '3y',
] as const

/** Rótulos na barra (PT) — semana e mês bem distintos dos minutos. */
export const INDICATOR_TOOLBAR_LABEL_PT: Record<string, string> = {
  '1m': '1 min',
  '5m': '5 min',
  '15m': '15 min',
  '1h': '1 h',
  '4h': '4 h',
  '1d': 'Diário',
  '1w': 'Semanal',
  '1M': 'Mensal',
  '2mo': '2 meses',
  '3mo': '3 meses',
  '6mo': '6 meses',
  '1y': '1 ano',
  '3y': '3 anos',
}

/** @deprecated Use TIMEFRAME_PRESETS */
export const BINANCE_INTERVALS = TIMEFRAME_PRESETS.filter(t => t.group !== 'periodo').map(t => ({
  value: t.interval,
  label: t.label,
}))
