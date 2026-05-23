import type { CoordinateMapper } from '@/lib/drawing-system/core/coordinate-mapper'
import { hitTestDrawings } from '@/lib/drawing-system/core/hit-test'
import { createDrawing, useDrawingStore } from '@/lib/drawing-system/store/drawing-store'
import {
  getDefaultStyleForTool,
  isFreehandTool,
  isMultiClickTool,
  isSingleClickTool,
  resolveToolMode,
  toolIdToDrawingType,
} from '@/lib/drawing-system/tools/tool-registry'
import { getToolSpec } from '@/lib/drawing-system/tools/tool-specs'
import type { DrawingDraft } from '@/lib/drawing-system/types'
import type { ChartPoint } from '@/lib/drawing-system/types'
import type { DrawingToolId } from '@/lib/btc/chart-drawings-config'
import type { OhlcvBar } from '@/lib/btc/types'

type DragState =
  | { kind: 'none' }
  | {
      kind: 'move'
      id: string
      handleIndex: number | 'body'
      originPoints: ChartPoint[]
      anchor: ChartPoint
    }

function pointsClose(a: ChartPoint, b: ChartPoint) {
  return a.time === b.time && Math.abs(a.price - b.price) < 1e-12
}

export class PointerEngine {
  private drag: DragState = { kind: 'none' }
  private chartW = 0
  private drawingGesture = false

  constructor(
    private mapper: CoordinateMapper,
    private bars: OhlcvBar[],
  ) {}

  setChartWidth(w: number) {
    this.chartW = w
  }

  setBars(bars: OhlcvBar[]) {
    this.bars = bars
    this.mapper.setBars(bars)
  }

  isCapturingGesture() {
    return this.drawingGesture || this.drag.kind === 'move'
  }

  cancelDraft() {
    this.drawingGesture = false
    this.drag = { kind: 'none' }
    useDrawingStore.getState().clearTransient()
  }

  /** Conclui polilinha / path (Enter ou duplo clique). */
  commitPolylineDraft() {
    const store = useDrawingStore.getState()
    const draft = store.transient.draft
    if (!draft || draft.requiredPoints !== 99 || draft.points.length < 2) return false
    store.addDrawing(
      createDrawing(draft.type, draft.points, {
        toolId: draft.toolId,
        style: draft.toolId ? getDefaultStyleForTool(draft.toolId as DrawingToolId) : undefined,
      }),
    )
    store.clearTransient()
    this.drawingGesture = false
    return true
  }

  private beginDrawDraft(toolId: DrawingToolId, type: DrawingDraft['type'], pt: ChartPoint) {
    const spec = getToolSpec(toolId)!
    useDrawingStore.getState().setTransientDraft({
      type,
      toolId,
      points: [pt],
      preview: pt,
      requiredPoints: spec.pointCount,
    })
    this.drawingGesture = true
  }

  /** @returns true se o evento foi consumido */
  handlePointerDown(clientX: number, clientY: number, container: HTMLElement): boolean {
    const store = useDrawingStore.getState()
    if (store.prefs.drawingsLocked) return false

    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const pt = this.mapper.fromXY(x, y)
    if (!pt) return false

    const mode = resolveToolMode(store.activeToolId)
    const drawings = store.getDrawings().filter((d) => d.visible)

    if (mode === 'erase') {
      const hit = hitTestDrawings(
        x,
        y,
        drawings,
        (pts) => this.mapper.pointsToXY(pts),
        store.selectedId,
        this.chartW,
        (p) => this.mapper.toXY(p),
      )
      if (hit) {
        store.removeDrawing(hit.drawingId)
        return true
      }
      return false
    }

    if (mode === 'draw' && store.activeToolId) {
      const toolId = store.activeToolId
      const type = toolIdToDrawingType(toolId)
      const spec = getToolSpec(toolId)
      if (!type || !spec) return false

      if (isSingleClickTool(toolId)) {
        let text: string | undefined
        if (spec.renderKind === 'text' || spec.renderKind === 'note' || spec.renderKind === 'callout') {
          const def = spec.renderKind === 'note' ? 'Nota' : spec.renderKind === 'callout' ? 'Comentário' : ''
          text = window.prompt('Texto', def)?.trim()
          if (spec.renderKind === 'text' && !text) return true
        }
        store.addDrawing(
          createDrawing(type, [pt], {
            toolId,
            text,
            style: getDefaultStyleForTool(toolId),
          }),
        )
        return true
      }

      if (isMultiClickTool(toolId)) {
        const draft = store.transient.draft
        if (draft?.toolId === toolId) {
          const last = draft.points[draft.points.length - 1]
          if (last && pointsClose(last, pt) && draft.points.length >= 2 && spec.pointCount >= 99) {
            store.addDrawing(
              createDrawing(type, draft.points, { toolId, style: getDefaultStyleForTool(toolId) }),
            )
            store.clearTransient()
            this.drawingGesture = false
            return true
          }
          const nextPoints = [...draft.points, pt]
          if (nextPoints.length >= spec.pointCount && spec.pointCount < 99) {
            store.addDrawing(
              createDrawing(type, nextPoints, { toolId, style: getDefaultStyleForTool(toolId) }),
            )
            store.clearTransient()
            this.drawingGesture = false
          } else {
            store.setTransientDraft({
              ...draft,
              points: nextPoints,
              preview: pt,
            })
            this.drawingGesture = true
          }
        } else {
          this.beginDrawDraft(toolId, type, pt)
        }
        return true
      }

      if (isFreehandTool(toolId)) {
        this.beginDrawDraft(toolId, type, pt)
        return true
      }

      this.beginDrawDraft(toolId, type, pt)
      return true
    }

    const hit = hitTestDrawings(
      x,
      y,
      drawings,
      (pts) => this.mapper.pointsToXY(pts),
      store.selectedId,
      this.chartW,
      (p) => this.mapper.toXY(p),
    )
    if (hit?.kind === 'handle') {
      const d = drawings.find((dr) => dr.id === hit.drawingId)
      if (!d || d.locked) return false
      store.pushHistory()
      store.select(hit.drawingId)
      this.drawingGesture = true
      this.drag = {
        kind: 'move',
        id: hit.drawingId,
        handleIndex: hit.handleIndex,
        originPoints: d.points.map((p) => ({ ...p })),
        anchor: pt,
      }
      store.setTransientMove({ id: hit.drawingId, points: d.points.map((p) => ({ ...p })) })
      return true
    }
    if (hit?.kind === 'body' || hit?.kind === 'fib-line') {
      const d = drawings.find((dr) => dr.id === hit.drawingId)
      if (!d || d.locked) return false
      store.pushHistory()
      store.select(hit.drawingId)
      this.drawingGesture = true
      this.drag = {
        kind: 'move',
        id: hit.drawingId,
        handleIndex: 'body',
        originPoints: d.points.map((p) => ({ ...p })),
        anchor: pt,
      }
      store.setTransientMove({ id: hit.drawingId, points: d.points.map((p) => ({ ...p })) })
      return true
    }

    store.select(null)
    return false
  }

  handlePointerMove(clientX: number, clientY: number, container: HTMLElement) {
    const store = useDrawingStore.getState()
    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const pt = this.mapper.fromXY(x, y)

    const gestureDraft = store.transient.draft
    const gestureMove = store.transient.move

    if (!gestureDraft && !gestureMove && this.drag.kind === 'none') {
      const drawings = store.getDrawings()
      const hit = hitTestDrawings(
        x,
        y,
        drawings,
        (p) => this.mapper.pointsToXY(p),
        store.selectedId,
        this.chartW,
        (p) => this.mapper.toXY(p),
      )
      store.setHovered(hit ? hit.drawingId : null)
      store.setHoveredFibLevel(hit?.kind === 'fib-line' ? hit.levelIndex : null)
    }

    if (!pt) return

    if (this.drag.kind === 'move' && gestureMove) {
      const { id, handleIndex, originPoints, anchor } = this.drag
      const dt = pt.time - anchor.time
      const dp = pt.price - anchor.price
      let next: ChartPoint[]
      if (handleIndex === 'body') {
        next = originPoints.map((p) => ({ time: p.time + dt, price: p.price + dp }))
      } else {
        next = originPoints.map((p, i) =>
          i === handleIndex ? { time: pt.time, price: pt.price } : { ...p },
        )
      }
      store.setTransientMove({ id, points: next })
      return
    }

    if (!gestureDraft) return

    if (gestureDraft.toolId && isFreehandTool(gestureDraft.toolId)) {
      const last = gestureDraft.points[gestureDraft.points.length - 1]
      if (!last || !pointsClose(last, pt)) {
        store.setTransientDraft({
          ...gestureDraft,
          points: [...gestureDraft.points, pt],
          preview: pt,
        })
      }
      return
    }

    if (gestureDraft.toolId && isMultiClickTool(gestureDraft.toolId)) {
      store.setTransientDraft({ ...gestureDraft, preview: pt })
      return
    }

    const prev = gestureDraft.preview
    if (!prev || !pointsClose(prev, pt)) {
      store.setTransientDraft({ ...gestureDraft, preview: pt })
    }
  }

  handlePointerUp(clientX: number, clientY: number, container: HTMLElement) {
    const store = useDrawingStore.getState()
    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const pt = this.mapper.fromXY(x, y)

    if (this.drag.kind === 'move') {
      const move = store.transient.move
      this.drag = { kind: 'none' }
      this.drawingGesture = false
      if (move) {
        store.updateDrawing(move.id, (d) => ({ ...d, points: move.points }))
      }
      store.setTransientMove(null)
      return
    }

    const draft = store.transient.draft
    if (!draft || !pt) {
      this.drawingGesture = false
      return
    }

    if (draft.toolId && isMultiClickTool(draft.toolId)) {
      return
    }

    this.drawingGesture = false

    if (draft.toolId && isFreehandTool(draft.toolId)) {
      if (draft.points.length >= 2) {
        store.addDrawing(
          createDrawing(draft.type, draft.points, {
            toolId: draft.toolId,
            style: getDefaultStyleForTool(draft.toolId),
          }),
        )
      }
      store.clearTransient()
      return
    }

    const start = draft.points[0]
    const end = pt
    const a = this.mapper.toXY(start)
    const b = this.mapper.toXY(end)
    if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) < 6) {
      store.clearTransient()
      return
    }

    store.addDrawing(
      createDrawing(draft.type, [start, end], {
        toolId: draft.toolId,
        style: draft.toolId ? getDefaultStyleForTool(draft.toolId) : undefined,
      }),
    )
    store.clearTransient()
  }
}
