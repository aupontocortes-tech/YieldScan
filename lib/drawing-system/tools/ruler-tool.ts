import type { DrawingType } from '@/lib/drawing-system/types'

export const RulerTool = {
  type: 'ruler' as DrawingType,
  toolId: 'ruler' as const,
  dragToComplete: true,
}
