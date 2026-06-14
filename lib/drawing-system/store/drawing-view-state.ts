import type { ChartPoint, Drawing, DrawingDraft } from '@/lib/drawing-system/types'
import { EMPTY_DRAWINGS } from '@/lib/drawing-system/store/drawing-store'

export type DrawingTransientState = {
  draft: DrawingDraft | null
  move: { id: string; points: ChartPoint[] } | null
}

export type DrawingStoreSnapshot = {
  scopeKey: string
  byScope: Record<string, { drawings: Drawing[] }>
  prefs: { drawingsVisible: boolean }
  draft: DrawingDraft | null
  transient: DrawingTransientState
}

export type DrawingPaintState = {
  drawings: Drawing[]
  draft: DrawingDraft | null
  isGesture: boolean
}

export function getDrawingPaintState(state: DrawingStoreSnapshot): DrawingPaintState {
  const base = state.prefs.drawingsVisible ? state.byScope[state.scopeKey]?.drawings ?? EMPTY_DRAWINGS : EMPTY_DRAWINGS
  const isGesture = Boolean(state.transient.draft || state.transient.move)

  let drawings = base
  if (state.transient.move) {
    const { id, points } = state.transient.move
    drawings = drawings.map((d) => (d.id === id ? { ...d, points } : d))
  }

  const draft = state.transient.draft ?? state.draft

  return { drawings, draft, isGesture }
}
