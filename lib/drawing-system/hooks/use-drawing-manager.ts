'use client'

import { useMemo } from 'react'
import { DrawingManager } from '@/lib/drawing-system/core/drawing-manager'
import { useDrawingStore } from '@/lib/drawing-system/store/drawing-store'

export function useDrawingManager() {
  return useMemo(() => new DrawingManager(useDrawingStore.getState()), [])
}
