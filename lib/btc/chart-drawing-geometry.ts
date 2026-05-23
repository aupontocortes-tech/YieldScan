import type { DrawingGeometryKind } from '@/lib/btc/chart-drawing-types'
import type { DrawingToolId } from '@/lib/btc/chart-drawings-config'

const HORIZONTAL = new Set([
  'horizontal-line',
  'flat-top-bottom',
  'anchored-vwap',
])
const VERTICAL = new Set(['vertical-line', 'cyclic-lines', 'fib-timezone'])
const CROSS = new Set(['cross-line'])
const RAY = new Set([
  'ray',
  'trend-angle',
  'projection',
  'forecast',
  'bar-pattern',
  'ghost-feed',
])
const EXTENDED = new Set(['extended-line', 'info-line', 'regression-trend', 'sine-line'])
const HRAY = new Set(['horizontal-ray'])
const RECT = new Set([
  'rectangle',
  'rotated-rectangle',
  'gann-box',
  'gann-square',
  'gann-square-fixed',
  'price-range',
  'date-range',
  'date-price-range',
  'highlighter',
  'fixed-range-volume',
  'anchored-volume',
])
const CIRCLE = new Set(['circle', 'ellipse', 'fib-circles', 'fib-spiral', 'speed-resistance-arcs'])
const FIB = new Set(['fib-retracement', 'fib-channel', 'fib-wedge'])
const FIB_EXT = new Set(['fib-extension-trend', 'fib-time-trend'])
const FIB_FAN = new Set(['speed-resistance-fan', 'line-fan', 'gann-fan'])
const FIB_TIME = new Set(['fib-timezone'])
const CHANNEL = new Set(['parallel-channel', 'disjoint-channel'])
const FORK = new Set([
  'pitchfork',
  'schiff-pitchfork',
  'modified-schiff-pitchfork',
  'inside-pitchfork',
])
const ARROW = new Set(['arrow', 'arrow-marker', 'arrow-up', 'arrow-down', 'flag', 'marker'])
const BRUSH = new Set(['brush'])
const POLY = new Set(['path', 'polyline', 'curve', 'double-curve', 'arc-shape', 'triangle-shape'])
const TEXT = new Set(['text', 'note', 'callout'])
const LONG = new Set(['long-position'])
const SHORT = new Set(['short-position'])
const MULTI = new Set([
  'xabcd',
  'cypher',
  'head-shoulders',
  'abcd',
  'triangle-pattern',
  'three-drives',
  'elliott-impulse',
  'elliott-corrective',
  'elliott-triangle',
  'elliott-double-combo',
  'elliott-triple-combo',
  'time-cycles',
])

const MULTI_COUNTS: Record<string, number> = {
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

export function getDrawingGeometry(toolId: DrawingToolId): DrawingGeometryKind {
  if (toolId === 'eraser') return 'erase'
  if (toolId === 'ruler') return 'ruler'
  if (HORIZONTAL.has(toolId)) return 'horizontal'
  if (VERTICAL.has(toolId)) return 'vertical'
  if (CROSS.has(toolId)) return 'cross'
  if (HRAY.has(toolId)) return 'horizontalRay'
  if (RAY.has(toolId) || toolId === 'trend-line') return 'ray'
  if (EXTENDED.has(toolId)) return 'extended'
  if (RECT.has(toolId)) return 'rectangle'
  if (CIRCLE.has(toolId)) return 'circle'
  if (FIB.has(toolId)) return 'fib'
  if (FIB_EXT.has(toolId)) return 'fibExtension'
  if (FIB_FAN.has(toolId)) return 'fibFan'
  if (FIB_TIME.has(toolId)) return 'fibTime'
  if (CHANNEL.has(toolId)) return 'parallelChannel'
  if (FORK.has(toolId)) return 'pitchfork'
  if (ARROW.has(toolId)) return 'arrow'
  if (BRUSH.has(toolId)) return 'brush'
  if (POLY.has(toolId)) return 'polyline'
  if (TEXT.has(toolId)) return 'text'
  if (LONG.has(toolId)) return 'long'
  if (SHORT.has(toolId)) return 'short'
  if (MULTI.has(toolId)) return 'multi'
  return 'line'
}

export function getRequiredPointCount(geometry: DrawingGeometryKind, toolId: DrawingToolId): number {
  switch (geometry) {
    case 'horizontal':
    case 'vertical':
    case 'cross':
    case 'text':
      return 1
    case 'line':
    case 'ray':
    case 'extended':
    case 'horizontalRay':
    case 'rectangle':
    case 'circle':
    case 'fib':
    case 'fibExtension':
    case 'fibFan':
    case 'arrow':
    case 'long':
    case 'short':
    case 'ruler':
      return 2
    case 'parallelChannel':
    case 'pitchfork':
    case 'fibTime':
      return 3
    case 'multi':
      return MULTI_COUNTS[toolId] ?? 4
    case 'polyline':
      return 99
    case 'brush':
      return 2
    default:
      return 2
  }
}

export function isFreehandGeometry(geometry: DrawingGeometryKind): boolean {
  return geometry === 'brush'
}

export function isClickToAddGeometry(geometry: DrawingGeometryKind): boolean {
  return geometry === 'polyline' || geometry === 'multi'
}

/** Um clique coloca o desenho (linha H/V, cruz). */
export function isSingleClickGeometry(geometry: DrawingGeometryKind): boolean {
  return geometry === 'horizontal' || geometry === 'vertical' || geometry === 'cross'
}

/** Arrastar do ponto A ao B e largar — como régua e caixas no TradingView. */
export function isDragToCompleteGeometry(geometry: DrawingGeometryKind): boolean {
  switch (geometry) {
    case 'ruler':
    case 'line':
    case 'ray':
    case 'extended':
    case 'horizontalRay':
    case 'rectangle':
    case 'circle':
    case 'fib':
    case 'fibExtension':
    case 'fibFan':
    case 'arrow':
    case 'long':
    case 'short':
      return true
    default:
      return false
  }
}

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const
