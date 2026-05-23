import type { DrawingType } from '@/lib/drawing-system/types'

export const TrendLineTool = {
  type: 'trendLine' as DrawingType,
  toolId: 'trend-line' as const,
  dragToComplete: true,
}
