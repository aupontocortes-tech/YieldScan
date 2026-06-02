import type { DrawingType } from '@/lib/drawing-system/types'
import type { DrawingToolId } from '@/lib/btc/chart-drawings-config'
import { getToolSpec, isDrawToolId } from '@/lib/drawing-system/tools/tool-specs'

export type ToolMode = 'draw' | 'erase' | 'action' | 'cursor'

const ERASE = new Set(['eraser'])
const ACTIONS = new Set([
  'hide-drawings',
  'lock-all',
  'remove-all',
  'continue-drawing',
  'weak-magnet',
  'zoom-in',
  'zoom-out',
])

export function resolveToolMode(toolId: DrawingToolId | null): ToolMode {
  if (!toolId) return 'cursor'
  if (ERASE.has(toolId)) return 'erase'
  if (ACTIONS.has(toolId)) return 'action'
  if (isDrawToolId(toolId)) return 'draw'
  return 'cursor'
}

export function toolIdToDrawingType(toolId: DrawingToolId): DrawingType | null {
  const spec = getToolSpec(toolId)
  return spec?.baseType ?? null
}

export function isDragTool(type: DrawingType): boolean {
  return (
    type === 'ruler' ||
    type === 'trendLine' ||
    type === 'rectangle' ||
    type === 'fibonacci' ||
    type === 'brush'
  )
}

export function isSingleClickTool(toolId: DrawingToolId): boolean {
  const spec = getToolSpec(toolId)
  return spec?.interaction === 'click1'
}

export function isMultiClickTool(toolId: DrawingToolId): boolean {
  const spec = getToolSpec(toolId)
  return spec?.interaction === 'clickN'
}

export function isFreehandTool(toolId: DrawingToolId): boolean {
  const spec = getToolSpec(toolId)
  return spec?.interaction === 'freehand'
}

export function isDrag2Tool(toolId: DrawingToolId): boolean {
  const spec = getToolSpec(toolId)
  return spec?.interaction === 'drag2'
}

const TYPE_TO_TOOL: Record<DrawingType, DrawingToolId> = {
  ruler: 'ruler',
  trendLine: 'trend-line',
  horizontalLine: 'horizontal-line',
  verticalLine: 'vertical-line',
  rectangle: 'rectangle',
  fibonacci: 'fib-retracement',
  text: 'text',
  brush: 'brush',
}

export const DRAWING_TYPE_LABELS: Record<DrawingType, string> = {
  ruler: 'Régua',
  trendLine: 'Linha de tendência',
  horizontalLine: 'Linha horizontal',
  verticalLine: 'Linha vertical',
  rectangle: 'Retângulo',
  fibonacci: 'Fibonacci',
  text: 'Texto',
  brush: 'Pincel',
}

export function drawingTypeToToolId(type: DrawingType): DrawingToolId {
  return TYPE_TO_TOOL[type]
}

export function getDefaultStyleForTool(toolId: DrawingToolId) {
  const spec = getToolSpec(toolId)
  return {
    color: spec?.defaultColor ?? '#2962FF',
    lineWidth: 1.5,
  }
}
