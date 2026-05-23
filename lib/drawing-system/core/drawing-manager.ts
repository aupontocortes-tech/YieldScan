import { createDrawing } from '@/lib/drawing-system/store/drawing-store'
import type { useDrawingStore } from '@/lib/drawing-system/store/drawing-store'
import type { ChartPoint, Drawing, DrawingType, FibLevelConfig } from '@/lib/drawing-system/types'
import {
  addFibLevel,
  removeFibLevel,
  updateFibLevelStyle,
} from '@/lib/drawing-system/tools/fib/FibRetracementTool'
import { resolveFibData } from '@/lib/drawing-system/tools/fib/FibMath'

type Store = ReturnType<typeof useDrawingStore.getState>

/** Fachada central — toda mutação de desenho passa aqui. */
export class DrawingManager {
  constructor(private store: Store) {}

  get drawings(): Drawing[] {
    return this.store.getDrawings().filter((d) => d.visible || true)
  }

  get visibleDrawings(): Drawing[] {
    if (!this.store.prefs.drawingsVisible) return []
    return this.store.getDrawings().filter((d) => d.visible)
  }

  create(type: DrawingType, points: ChartPoint[], text?: string) {
    const drawing = createDrawing(type, points, text ? { text } : undefined)
    this.store.addDrawing(drawing)
    return drawing
  }

  select(id: string | null) {
    this.store.select(id)
  }

  remove(id: string) {
    this.store.removeDrawing(id)
  }

  removeSelected() {
    if (this.store.selectedId) this.store.removeDrawing(this.store.selectedId)
  }

  removeAll() {
    this.store.removeAllDrawings()
  }

  moveDrawing(id: string, points: ChartPoint[]) {
    this.store.updateDrawing(id, (d) => ({ ...d, points }))
  }

  setLockedGlobal(locked: boolean) {
    this.store.setPrefs({ drawingsLocked: locked })
  }

  setVisibleGlobal(visible: boolean) {
    this.store.setPrefs({ drawingsVisible: visible })
  }

  undo() {
    this.store.undo()
  }

  redo() {
    this.store.redo()
  }

  isLocked(drawing?: Drawing) {
    if (this.store.prefs.drawingsLocked) return true
    return drawing?.locked ?? false
  }

  getFibLevels(id: string): FibLevelConfig[] {
    const d = this.store.getDrawings().find((dr) => dr.id === id)
    if (!d?.fib) return resolveFibData(undefined).levels
    return resolveFibData(d.fib).levels
  }

  addFibLevel(id: string, ratio: number) {
    this.store.updateDrawing(id, (d) => ({
      ...d,
      fib: addFibLevel(resolveFibData(d.fib), ratio),
    }))
  }

  removeFibLevel(id: string, ratio: number) {
    this.store.updateDrawing(id, (d) => ({
      ...d,
      fib: removeFibLevel(resolveFibData(d.fib), ratio),
    }))
  }

  setFibLevelStyle(
    id: string,
    ratio: number,
    patch: Partial<Pick<FibLevelConfig, 'color' | 'lineWidth' | 'visible'>>,
  ) {
    this.store.updateDrawing(id, (d) => ({
      ...d,
      fib: updateFibLevelStyle(resolveFibData(d.fib), ratio, patch),
    }))
  }

  setFibStyle(id: string, patch: Partial<Drawing['style']>) {
    this.store.updateDrawing(id, (d) => ({
      ...d,
      style: { ...d.style, ...patch },
    }))
  }
}
