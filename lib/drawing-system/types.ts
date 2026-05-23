export type DrawingType =
  | 'ruler'
  | 'trendLine'
  | 'horizontalLine'
  | 'verticalLine'
  | 'rectangle'
  | 'fibonacci'
  | 'text'
  | 'brush'

export type ChartPoint = {
  time: number
  price: number
}

export type DrawingStyle = {
  color: string
  lineWidth: number
  fill?: string
}

/** Nível individual de Fibonacci Retracement (estilo TradingView). */
export type FibLevelConfig = {
  ratio: number
  visible: boolean
  color?: string
  lineWidth?: number
}

export type FibRetracementData = {
  levels: FibLevelConfig[]
  showTrendLine?: boolean
  showBackground?: boolean
  /** Estende linhas até à borda direita do gráfico visível. */
  extendRight?: boolean
}

export type Drawing = {
  id: string
  type: DrawingType
  /** Ferramenta original do catálogo (renderização TradingView). */
  toolId?: string
  points: ChartPoint[]
  style: DrawingStyle
  visible: boolean
  locked: boolean
  zIndex: number
  text?: string
  fib?: FibRetracementData
  createdAt: number
}

export type DrawingDraft = {
  type: DrawingType
  toolId?: string
  points: ChartPoint[]
  preview?: ChartPoint
  requiredPoints?: number
}

export type ChartApiRef = {
  chart: import('lightweight-charts').IChartApi
  series: import('lightweight-charts').ISeriesApi<'Candlestick'>
  container: HTMLElement
} | null

export type HandleHit = {
  drawingId: string
  handleIndex: number
}

export type BodyHit = {
  drawingId: string
}

export type HitResult =
  | { kind: 'handle'; drawingId: string; handleIndex: number; distance: number }
  | { kind: 'body'; drawingId: string; distance: number }
  | { kind: 'fib-line'; drawingId: string; levelIndex: number; distance: number }
  | null

export type DragMode =
  | { kind: 'none' }
  | { kind: 'draw'; type: DrawingType }
  | { kind: 'move'; drawingId: string; handleIndex: number | 'body'; origin: ChartPoint[]; anchor: ChartPoint }
  | { kind: 'pan-blocked' }

export const DEFAULT_STYLE: DrawingStyle = {
  color: '#2962FF',
  lineWidth: 1.5,
}
