import type { DrawingToolId } from '@/lib/btc/chart-drawings-config'

export type ChartPoint = {
  time: number
  price: number
}

export type DrawingGeometryKind =
  | 'horizontal'
  | 'vertical'
  | 'cross'
  | 'line'
  | 'ray'
  | 'extended'
  | 'horizontalRay'
  | 'rectangle'
  | 'circle'
  | 'fib'
  | 'fibExtension'
  | 'fibFan'
  | 'fibTime'
  | 'parallelChannel'
  | 'pitchfork'
  | 'arrow'
  | 'polyline'
  | 'brush'
  | 'text'
  | 'long'
  | 'short'
  | 'multi'
  | 'ruler'
  | 'select'
  | 'erase'

export type PlacedDrawing = {
  id: string
  toolId: DrawingToolId
  label: string
  geometry: DrawingGeometryKind
  points: ChartPoint[]
  text?: string
  locked?: boolean
}

export type DrawingDraft = {
  toolId: DrawingToolId
  label: string
  geometry: DrawingGeometryKind
  points: ChartPoint[]
  preview?: ChartPoint
  text?: string
}

export type MainChartApi = {
  chart: import('lightweight-charts').IChartApi
  series: import('lightweight-charts').ISeriesApi<'Candlestick'>
  container: HTMLElement
}
