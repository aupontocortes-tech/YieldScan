import type { CoordinateMapper, XY } from '@/lib/drawing-system/core/coordinate-mapper'
import type { Drawing, DrawingDraft, DrawingType } from '@/lib/drawing-system/types'
import { computeMeasure, measureLabelLines } from '@/lib/drawing-system/utils/measure'
import { renderFibRetracement } from '@/lib/drawing-system/tools/fib/FibRenderer'
import { renderToolDrawing } from '@/lib/drawing-system/renderers/extended-renderer'
import { getDrawingPaintState } from '@/lib/drawing-system/store/drawing-view-state'
import type { DrawingStoreSnapshot } from '@/lib/drawing-system/store/drawing-view-state'
import { getToolSpec } from '@/lib/drawing-system/tools/tool-specs'
import { drawingTypeToToolId } from '@/lib/drawing-system/tools/tool-registry'
import type { OhlcvBar } from '@/lib/btc/types'

const SEL = '#f0b90b'
const BLUE = '#2962FF'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawHandles(ctx: CanvasRenderingContext2D, xy: XY[], selected: boolean) {
  for (const p of xy) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#131722'
    ctx.fill()
    ctx.strokeStyle = selected ? SEL : BLUE
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

function drawRuler(
  ctx: CanvasRenderingContext2D,
  xy: XY[],
  p0: { time: number; price: number },
  p1: { time: number; price: number },
  bars: OhlcvBar[],
  chartW: number,
  selected: boolean,
) {
  if (xy.length < 2) return
  const [a, b] = xy
  const up = p1.price >= p0.price
  const color = up ? '#26a69a' : '#ef5350'
  const stats = computeMeasure(p0, p1, bars, b.x - a.x, b.y - a.y)
  const lines = measureLabelLines(stats)

  const ang = Math.atan2(b.y - a.y, b.x - a.x)
  const perp = ang + Math.PI / 2
  const cap = 5

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = selected ? 2 : 1.5
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()

  for (const p of [a, b]) {
    ctx.beginPath()
    ctx.moveTo(p.x + Math.cos(perp) * cap, p.y + Math.sin(perp) * cap)
    ctx.lineTo(p.x - Math.cos(perp) * cap, p.y - Math.sin(perp) * cap)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = '#131722'
    ctx.fill()
    ctx.stroke()
  }

  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const lh = 14
  const padX = 8
  const padY = 6
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width))
  const boxW = textW + padX * 2
  const boxH = lines.length * lh + padY * 2
  let bx = mx - boxW / 2
  let by = my - boxH - 12
  if (by < 4) by = my + 12
  bx = Math.max(4, Math.min(chartW - boxW - 4, bx))

  ctx.fillStyle = 'rgba(19, 23, 34, 0.94)'
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  roundRect(ctx, bx, by, boxW, boxH, 4)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = color
  lines.forEach((line, i) => ctx.fillText(line, bx + padX, by + padY + lh * i + lh / 2))
  ctx.restore()
}

function drawByType(
  ctx: CanvasRenderingContext2D,
  type: DrawingType,
  xy: XY[],
  points: Drawing['points'],
  bars: OhlcvBar[],
  chartW: number,
  chartH: number,
  selected: boolean,
  text?: string,
) {
  if (!xy.length) return
  ctx.strokeStyle = selected ? SEL : BLUE
  ctx.lineWidth = selected ? 2 : 1.5

  if (type === 'ruler' && points.length >= 2) {
    drawRuler(ctx, xy, points[0], points[1], bars, chartW, selected)
    return
  }

  if (type === 'horizontalLine' && xy[0]) {
    ctx.beginPath()
    ctx.moveTo(0, xy[0].y)
    ctx.lineTo(chartW, xy[0].y)
    ctx.stroke()
    if (selected) drawHandles(ctx, [xy[0]], true)
    return
  }

  if (type === 'verticalLine' && xy[0]) {
    ctx.beginPath()
    ctx.moveTo(xy[0].x, 0)
    ctx.lineTo(xy[0].x, chartH)
    ctx.stroke()
    if (selected) drawHandles(ctx, [xy[0]], true)
    return
  }

  if (type === 'rectangle' && xy.length >= 2) {
    const x = Math.min(xy[0].x, xy[1].x)
    const y = Math.min(xy[0].y, xy[1].y)
    const w = Math.abs(xy[1].x - xy[0].x)
    const h = Math.abs(xy[1].y - xy[0].y)
    ctx.fillStyle = selected ? 'rgba(240,185,11,0.08)' : 'rgba(41,98,255,0.06)'
    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x, y, w, h)
    if (selected) {
      drawHandles(
        ctx,
        [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: h },
          { x, y: h },
        ],
        true,
      )
    }
    return
  }


  if (type === 'brush' && xy.length >= 2) {
    ctx.beginPath()
    ctx.moveTo(xy[0].x, xy[0].y)
    for (let i = 1; i < xy.length; i++) ctx.lineTo(xy[i].x, xy[i].y)
    ctx.stroke()
    return
  }

  if (type === 'text' && xy[0]) {
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillStyle = selected ? SEL : '#e5e7eb'
    ctx.fillText(text ?? '', xy[0].x + 4, xy[0].y - 4)
    if (selected) drawHandles(ctx, [xy[0]], true)
    return
  }

  if (xy.length >= 2) {
    ctx.beginPath()
    ctx.moveTo(xy[0].x, xy[0].y)
    ctx.lineTo(xy[1].x, xy[1].y)
    ctx.stroke()
    if (selected) drawHandles(ctx, [xy[0], xy[1]], true)
  }
}

export function renderCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  mapper: CoordinateMapper,
  storeSnapshot: DrawingStoreSnapshot,
  selectedId: string | null,
  hoveredId: string | null,
  bars: OhlcvBar[],
  hoveredFibLevelIndex: number | null = null,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const { drawings, draft } = getDrawingPaintState(storeSnapshot)
  const sorted = [...drawings].sort((a, b) => a.zIndex - b.zIndex)
  for (const d of sorted) {
    if (!d.visible) continue
    const xy = mapper.pointsToXY(d.points)
    const selected = d.id === selectedId
    const hoveredLevel =
      d.id === hoveredId && hoveredFibLevelIndex != null ? hoveredFibLevelIndex : null

    if (d.type === 'ruler' && d.points.length >= 2) {
      drawByType(ctx, d.type, xy, d.points, bars, width, height, selected, d.text)
    } else {
      renderToolDrawing(ctx, d, mapper, width, height, selected, false)
      if (d.id === hoveredId && !selected && xy.length >= 2) {
        ctx.save()
        ctx.strokeStyle = 'rgba(240,185,11,0.5)'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(xy[0].x, xy[0].y)
        ctx.lineTo(xy[xy.length - 1].x, xy[xy.length - 1].y)
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  if (draft) {
    const pts = draft.preview ? [...draft.points, draft.preview] : draft.points
    const toolId = draft.toolId ?? drawingTypeToToolId(draft.type)
    const previewDrawing = {
      id: '__draft__',
      type: draft.type,
      toolId,
      points: pts,
      style: { color: getToolSpec(toolId)?.defaultColor ?? '#2962FF', lineWidth: 1.5 },
      visible: true,
      locked: false,
      zIndex: 0,
      createdAt: 0,
    }
    if (draft.type === 'ruler' && pts.length >= 2) {
      const xy = mapper.pointsToXY(pts)
      drawByType(ctx, draft.type, xy, pts, bars, width, height, true, undefined)
    } else {
      renderToolDrawing(ctx, previewDrawing, mapper, width, height, true, true)
    }
  }
}
