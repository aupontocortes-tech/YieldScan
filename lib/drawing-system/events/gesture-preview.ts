import type { DrawingTransientState } from '@/lib/drawing-system/store/drawing-view-state'

/** Preview ao vivo durante gesto — evita Zustand a cada pointermove (fluido no mobile). */
let preview: DrawingTransientState | null = null

export function getGesturePreview(): DrawingTransientState | null {
  return preview
}

export function setGesturePreview(next: DrawingTransientState | null) {
  preview = next
}

export function clearGesturePreview() {
  preview = null
}
