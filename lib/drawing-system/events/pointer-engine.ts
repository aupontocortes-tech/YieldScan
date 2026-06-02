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
import type { DrawingTransientState } from '@/lib/drawing-system/store/drawing-view-state'
import { snapPoint } from '@/lib/drawing-system/utils/snap'
import {
  clearGesturePreview,
  getGesturePreview,
  setGesturePreview,
} from '@/lib/drawing-system/events/gesture-preview'

/** Distância mínima (px) antes de atualizar preview / pincel — menos trabalho no mobile. */
const PREVIEW_MOVE_PX = 2
const FREEHAND_MOVE_PX = 3

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
  private lastClientX = 0
  private lastClientY = 0
  private hasLastClient = false

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
    this.hasLastClient = false
    clearGesturePreview()
    useDrawingStore.getState().clearTransient()
  }

  private resetMoveAnchor(clientX: number, clientY: number) {
    this.lastClientX = clientX
    this.lastClientY = clientY
    this.hasLastClient = true
  }

  private movedEnough(clientX: number, clientY: number, minPx: number): boolean {
    if (!this.hasLastClient) return true
    return Math.hypot(clientX - this.lastClientX, clientY - this.lastClientY) >= minPx
  }

  private snapPt(pt: ChartPoint): ChartPoint {
    return snapPoint(pt, this.bars, useDrawingStore.getState().prefs.weakMagnet)
  }

  private activeTransient(): DrawingTransientState {
    const live = getGesturePreview()
    if (live) return live
    const s = useDrawingStore.getState().transient
    return s
  }

  private pushGestureDraft(draft: NonNullable<DrawingDraft>) {
    setGesturePreview({ draft, move: null })
  }

  private pushGestureMove(move: NonNullable<DrawingTransientState['move']>) {
    setGesturePreview({ draft: null, move })
  }

  /** Conclui polilinha / path (Enter ou duplo clique). */
  commitPolylineDraft() {
    const store = useDrawingStore.getState()
    const draft = getGesturePreview()?.draft ?? store.transient.draft
    if (!draft || draft.requiredPoints !== 99 || draft.points.length < 2) return false
    store.addDrawing(
      createDrawing(draft.type, draft.points, {
        toolId: draft.toolId,
        style: draft.toolId ? getDefaultStyleForTool(draft.toolId as DrawingToolId) : undefined,
      }),
    )
    clearGesturePreview()
    store.clearTransient()
    this.drawingGesture = false
    return true
  }

  private beginDrawDraft(toolId: DrawingToolId, type: DrawingDraft['type'], pt: ChartPoint) {
    const spec = getToolSpec(toolId)!
    this.pushGestureDraft({
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

      this.resetMoveAnchor(clientX, clientY)

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
        const draft = store.transient.draft ?? getGesturePreview()?.draft
        if (draft?.toolId === toolId) {
          const last = draft.points[draft.points.length - 1]
          if (last && pointsClose(last, pt) && draft.points.length >= 2 && spec.pointCount >= 99) {
            store.addDrawing(
              createDrawing(type, draft.points, { toolId, style: getDefaultStyleForTool(toolId) }),
            )
            clearGesturePreview()
            store.clearTransient()
            this.drawingGesture = false
            return true
          }
          const nextPoints = [...draft.points, pt]
          if (nextPoints.length >= spec.pointCount && spec.pointCount < 99) {
            store.addDrawing(
              createDrawing(type, nextPoints, { toolId, style: getDefaultStyleForTool(toolId) }),
            )
            clearGesturePreview()
            store.clearTransient()
            this.drawingGesture = false
          } else {
            const next = {
              ...draft,
              points: nextPoints,
              preview: pt,
            }
            store.setTransientDraft(next)
            this.pushGestureDraft(next)
            this.drawingGesture = true
          }
        } else {
          clearGesturePreview()
          store.setTransientDraft(null)
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
      this.resetMoveAnchor(clientX, clientY)
      this.drag = {
        kind: 'move',
        id: hit.drawingId,
        handleIndex: hit.handleIndex,
        originPoints: d.points.map((p) => ({ ...p })),
        anchor: pt,
      }
      this.pushGestureMove({ id: hit.drawingId, points: d.points.map((p) => ({ ...p })) })
      return true
    }
    if (hit?.kind === 'body' || hit?.kind === 'fib-line') {
      const d = drawings.find((dr) => dr.id === hit.drawingId)
      if (!d || d.locked) return false
      store.pushHistory()
      store.select(hit.drawingId)
      this.drawingGesture = true
      this.resetMoveAnchor(clientX, clientY)
      this.drag = {
        kind: 'move',
        id: hit.drawingId,
        handleIndex: 'body',
        originPoints: d.points.map((p) => ({ ...p })),
        anchor: pt,
      }
      this.pushGestureMove({ id: hit.drawingId, points: d.points.map((p) => ({ ...p })) })
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

    const { draft: gestureDraft, move: gestureMove } = this.activeTransient()

    if (!gestureDraft && !gestureMove && this.drag.kind === 'none') {
      const ptHover = this.mapper.fromXY(x, y, { snap: false })
      if (!ptHover) return
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
      return
    }

    if (!this.movedEnough(clientX, clientY, PREVIEW_MOVE_PX)) return

    const pt = this.mapper.fromXY(x, y, { snap: false })
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
      this.pushGestureMove({ id, points: next })
      this.resetMoveAnchor(clientX, clientY)
      return
    }

    if (!gestureDraft) return

    if (gestureDraft.toolId && isFreehandTool(gestureDraft.toolId)) {
      if (!this.movedEnough(clientX, clientY, FREEHAND_MOVE_PX)) return
      const last = gestureDraft.points[gestureDraft.points.length - 1]
      if (!last || !pointsClose(last, pt)) {
        this.pushGestureDraft({
          ...gestureDraft,
          points: [...gestureDraft.points, pt],
          preview: pt,
        })
        this.resetMoveAnchor(clientX, clientY)
      }
      return
    }

    if (gestureDraft.toolId && isMultiClickTool(gestureDraft.toolId)) {
      this.pushGestureDraft({ ...gestureDraft, preview: pt })
      this.resetMoveAnchor(clientX, clientY)
      return
    }

    this.pushGestureDraft({ ...gestureDraft, preview: pt })
    this.resetMoveAnchor(clientX, clientY)
  }

  handlePointerUp(clientX: number, clientY: number, container: HTMLElement) {
    const store = useDrawingStore.getState()
    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const rawEnd = this.mapper.fromXY(x, y, { snap: false })
    const pt = rawEnd ? this.snapPt(rawEnd) : null

    this.hasLastClient = false

    if (this.drag.kind === 'move') {
      const move = getGesturePreview()?.move
      this.drag = { kind: 'none' }
      this.drawingGesture = false
      clearGesturePreview()
      if (move) {
        store.updateDrawing(move.id, (d) => ({ ...d, points: move.points }))
      }
      store.setTransientMove(null)
      return
    }

    const draft = getGesturePreview()?.draft ?? store.transient.draft
    if (!draft || !pt) {
      this.drawingGesture = false
      clearGesturePreview()
      return
    }

    if (draft.toolId && isMultiClickTool(draft.toolId)) {
      store.setTransientDraft({ ...draft, preview: pt })
      clearGesturePreview()
      return
    }

    this.drawingGesture = false
    clearGesturePreview()

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

    const start = this.snapPt(draft.points[0])
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
