import type { DrawingToolId } from '@/lib/btc/chart-drawings-config'
import type { DrawingType } from '@/lib/drawing-system/types'

export type InteractionMode = 'drag2' | 'click1' | 'clickN' | 'freehand'

export type RenderKind =
  | 'segment'
  | 'ray'
  | 'extended'
  | 'hline'
  | 'vline'
  | 'hlineRay'
  | 'cross'
  | 'rectangle'
  | 'ellipse'
  | 'circle'
  | 'highlighter'
  | 'fib'
  | 'fibExtension'
  | 'fibChannel'
  | 'fibTime'
  | 'fan'
  | 'arcs'
  | 'ruler'
  | 'brush'
  | 'polyline'
  | 'arrow'
  | 'arrowUp'
  | 'arrowDown'
  | 'text'
  | 'note'
  | 'callout'
  | 'flag'
  | 'marker'
  | 'long'
  | 'short'
  | 'multi'
  | 'parallelChannel'
  | 'pitchfork'
  | 'sine'
  | 'cyclic'
  | 'volumeProfile'
  | 'vwap'
  | 'gannBox'
  | 'gannFan'

export type ToolSpec = {
  baseType: DrawingType
  renderKind: RenderKind
  interaction: InteractionMode
  /** Pontos necessários (clickN). 99 = polilinha até concluir. */
  pointCount: number
  defaultColor?: string
  fillOpacity?: number
}

const MULTI: Record<string, number> = {
  xabcd: 5,
  cypher: 5,
  'head-shoulders': 5,
  abcd: 4,
  'triangle-pattern': 4,
  'three-drives': 6,
  'elliott-impulse': 5,
  'elliott-corrective': 3,
  'elliott-triangle': 5,
  'elliott-double-combo': 3,
  'elliott-triple-combo': 4,
  'time-cycles': 4,
}

function spec(
  baseType: DrawingType,
  renderKind: RenderKind,
  interaction: InteractionMode,
  pointCount = 2,
  extra?: Partial<ToolSpec>,
): ToolSpec {
  return { baseType, renderKind, interaction, pointCount, ...extra }
}

const SPECS: Record<string, ToolSpec> = {
  ruler: spec('ruler', 'ruler', 'drag2'),
  'trend-line': spec('trendLine', 'segment', 'drag2'),
  ray: spec('trendLine', 'ray', 'drag2'),
  'info-line': spec('trendLine', 'segment', 'drag2', 2, { defaultColor: '#787B86' }),
  'extended-line': spec('trendLine', 'extended', 'drag2'),
  'trend-angle': spec('trendLine', 'segment', 'drag2'),
  'horizontal-line': spec('horizontalLine', 'hline', 'click1'),
  'horizontal-ray': spec('horizontalLine', 'hlineRay', 'click1'),
  'vertical-line': spec('verticalLine', 'vline', 'click1'),
  'cross-line': spec('verticalLine', 'cross', 'click1'),
  'parallel-channel': spec('trendLine', 'parallelChannel', 'clickN', 3),
  'regression-trend': spec('trendLine', 'parallelChannel', 'drag2'),
  'flat-top-bottom': spec('horizontalLine', 'hline', 'drag2'),
  'disjoint-channel': spec('trendLine', 'parallelChannel', 'clickN', 3),
  pitchfork: spec('trendLine', 'pitchfork', 'clickN', 3),
  'schiff-pitchfork': spec('trendLine', 'pitchfork', 'clickN', 3),
  'modified-schiff-pitchfork': spec('trendLine', 'pitchfork', 'clickN', 3),
  'inside-pitchfork': spec('trendLine', 'pitchfork', 'clickN', 3),

  'fib-retracement': spec('fibonacci', 'fib', 'drag2', 2, { defaultColor: '#787B86' }),
  'fib-extension-trend': spec('fibonacci', 'fibExtension', 'drag2', 2, { defaultColor: '#787B86' }),
  'fib-channel': spec('fibonacci', 'fibChannel', 'drag2', 2, { defaultColor: '#787B86' }),
  'fib-timezone': spec('fibonacci', 'fibTime', 'drag2', 2, { defaultColor: '#787B86' }),
  'speed-resistance-fan': spec('fibonacci', 'fan', 'drag2', 2, { defaultColor: '#787B86' }),
  'fib-time-trend': spec('fibonacci', 'fibTime', 'drag2', 2, { defaultColor: '#787B86' }),
  'fib-circles': spec('fibonacci', 'arcs', 'drag2', 2, { defaultColor: '#787B86' }),
  'fib-spiral': spec('fibonacci', 'arcs', 'drag2', 2, { defaultColor: '#787B86' }),
  'speed-resistance-arcs': spec('fibonacci', 'arcs', 'drag2', 2, { defaultColor: '#787B86' }),
  'fib-wedge': spec('fibonacci', 'fan', 'drag2', 2, { defaultColor: '#787B86' }),
  'line-fan': spec('fibonacci', 'fan', 'drag2', 2, { defaultColor: '#787B86' }),
  'gann-box': spec('rectangle', 'gannBox', 'drag2', 2, { defaultColor: '#787B86' }),
  'gann-square-fixed': spec('rectangle', 'gannBox', 'drag2', 2, { defaultColor: '#787B86' }),
  'gann-square': spec('rectangle', 'gannBox', 'drag2', 2, { defaultColor: '#787B86' }),
  'gann-fan': spec('fibonacci', 'gannFan', 'drag2', 2, { defaultColor: '#787B86' }),

  xabcd: spec('trendLine', 'multi', 'clickN', MULTI.xabcd),
  cypher: spec('trendLine', 'multi', 'clickN', MULTI.cypher),
  'head-shoulders': spec('trendLine', 'multi', 'clickN', MULTI['head-shoulders']),
  abcd: spec('trendLine', 'multi', 'clickN', MULTI.abcd),
  'triangle-pattern': spec('trendLine', 'multi', 'clickN', MULTI['triangle-pattern']),
  'three-drives': spec('trendLine', 'multi', 'clickN', MULTI['three-drives']),
  'elliott-impulse': spec('trendLine', 'multi', 'clickN', MULTI['elliott-impulse']),
  'elliott-corrective': spec('trendLine', 'multi', 'clickN', MULTI['elliott-corrective']),
  'elliott-triangle': spec('trendLine', 'multi', 'clickN', MULTI['elliott-triangle']),
  'elliott-double-combo': spec('trendLine', 'multi', 'clickN', MULTI['elliott-double-combo']),
  'elliott-triple-combo': spec('trendLine', 'multi', 'clickN', MULTI['elliott-triple-combo']),
  'cyclic-lines': spec('verticalLine', 'cyclic', 'drag2'),
  'time-cycles': spec('trendLine', 'multi', 'clickN', MULTI['time-cycles']),
  'sine-line': spec('trendLine', 'sine', 'drag2'),

  'long-position': spec('rectangle', 'long', 'drag2', 2, { defaultColor: '#26a69a', fillOpacity: 0.12 }),
  'short-position': spec('rectangle', 'short', 'drag2', 2, { defaultColor: '#ef5350', fillOpacity: 0.12 }),
  forecast: spec('trendLine', 'ray', 'drag2', 2, { defaultColor: '#2962FF' }),
  'bar-pattern': spec('rectangle', 'rectangle', 'drag2'),
  'ghost-feed': spec('trendLine', 'segment', 'drag2', 2, { defaultColor: 'rgba(120,123,134,0.6)' }),
  projection: spec('trendLine', 'ray', 'drag2'),
  'anchored-vwap': spec('horizontalLine', 'vwap', 'click1', 1, { defaultColor: '#e040fb' }),
  'fixed-range-volume': spec('rectangle', 'volumeProfile', 'drag2'),
  'anchored-volume': spec('rectangle', 'volumeProfile', 'drag2'),
  'price-range': spec('rectangle', 'rectangle', 'drag2'),
  'date-range': spec('rectangle', 'rectangle', 'drag2'),
  'date-price-range': spec('rectangle', 'rectangle', 'drag2'),

  brush: spec('brush', 'brush', 'freehand'),
  highlighter: spec('rectangle', 'highlighter', 'drag2', 2, { defaultColor: '#f0b90b', fillOpacity: 0.2 }),
  'arrow-marker': spec('trendLine', 'arrow', 'drag2'),
  arrow: spec('trendLine', 'arrow', 'drag2'),
  'arrow-up': spec('trendLine', 'arrowUp', 'drag2'),
  'arrow-down': spec('trendLine', 'arrowDown', 'drag2'),
  rectangle: spec('rectangle', 'rectangle', 'drag2'),
  'rotated-rectangle': spec('rectangle', 'rectangle', 'drag2'),
  path: spec('brush', 'polyline', 'clickN', 99),
  circle: spec('rectangle', 'circle', 'drag2'),
  ellipse: spec('rectangle', 'ellipse', 'drag2'),
  polyline: spec('brush', 'polyline', 'clickN', 99),
  'triangle-shape': spec('trendLine', 'multi', 'clickN', 3),
  'arc-shape': spec('trendLine', 'arcs', 'drag2'),
  curve: spec('brush', 'polyline', 'clickN', 99),
  'double-curve': spec('brush', 'polyline', 'clickN', 99),
  text: spec('text', 'text', 'click1', 1),
  note: spec('text', 'note', 'click1', 1),
  callout: spec('text', 'callout', 'click1', 1),
  flag: spec('text', 'flag', 'click1', 1),
  marker: spec('text', 'marker', 'click1', 1),
}

export function getToolSpec(toolId: DrawingToolId | null | undefined): ToolSpec | null {
  if (!toolId) return null
  return SPECS[toolId] ?? null
}

export function isDrawToolId(toolId: DrawingToolId): boolean {
  return getToolSpec(toolId) != null
}

export const PATTERN_LABELS: Record<string, string[]> = {
  xabcd: ['X', 'A', 'B', 'C', 'D'],
  cypher: ['X', 'A', 'B', 'C', 'D'],
  'head-shoulders': ['E', 'S1', 'H', 'S2', 'E2'],
  abcd: ['A', 'B', 'C', 'D'],
  'triangle-pattern': ['A', 'B', 'C', 'D'],
  'three-drives': ['1', '2', '3', '4', '5', '6'],
  'elliott-impulse': ['1', '2', '3', '4', '5'],
  'elliott-corrective': ['A', 'B', 'C'],
  'elliott-triangle': ['A', 'B', 'C', 'D', 'E'],
  'elliott-double-combo': ['W', 'X', 'Y'],
  'elliott-triple-combo': ['W', 'X', 'Y', 'Z'],
  'time-cycles': ['1', '2', '3', '4'],
  'triangle-shape': ['A', 'B', 'C'],
}
