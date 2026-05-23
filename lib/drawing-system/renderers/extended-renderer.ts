import type { CoordinateMapper, XY } from '@/lib/drawing-system/core/coordinate-mapper'
import type { Drawing } from '@/lib/drawing-system/types'
import { renderFibRetracement } from '@/lib/drawing-system/tools/fib/FibRenderer'
import { PATTERN_LABELS, type RenderKind } from '@/lib/drawing-system/tools/tool-specs'
import { getToolSpec } from '@/lib/drawing-system/tools/tool-specs'
import { drawingTypeToToolId } from '@/lib/drawing-system/tools/tool-registry'
import { formatMeasurePrice } from '@/lib/drawing-system/utils/measure'

const SEL = '#f0b90b'
const FONT = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function stroke(ctx: CanvasRenderingContext2D, color: string, w: number, selected: boolean) {
  ctx.strokeStyle = selected ? SEL : color
  ctx.lineWidth = selected ? Math.max(w, 2) : w
}

function drawHandles(ctx: CanvasRenderingContext2D, xy: XY[], selected: boolean) {
  const edge = selected ? SEL : '#2962FF'
  for (const p of xy) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#131722'
    ctx.fill()
    ctx.strokeStyle = edge
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

function drawSegment(ctx: CanvasRenderingContext2D, xy: XY[], dash?: number[]) {
  if (xy.length < 2) return
  ctx.beginPath()
  ctx.moveTo(xy[0].x, xy[0].y)
  ctx.lineTo(xy[1].x, xy[1].y)
  if (dash) ctx.setLineDash(dash)
  ctx.stroke()
  if (dash) ctx.setLineDash([])
}

function drawExtended(ctx: CanvasRenderingContext2D, xy: XY[], chartW: number) {
  if (xy.length < 2) return
  const dx = xy[1].x - xy[0].x
  const dy = xy[1].y - xy[0].y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const extend = chartW * 2
  ctx.beginPath()
  ctx.moveTo(xy[0].x - ux * extend, xy[0].y - uy * extend)
  ctx.lineTo(xy[1].x + ux * extend, xy[1].y + uy * extend)
  ctx.setLineDash([4, 3])
  ctx.stroke()
  ctx.setLineDash([])
}

function drawRay(ctx: CanvasRenderingContext2D, xy: XY[], chartW: number, chartH: number) {
  if (xy.length < 2) return
  const dx = xy[1].x - xy[0].x
  const dy = xy[1].y - xy[0].y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const t = Math.max(chartW, chartH) * 2
  ctx.beginPath()
  ctx.moveTo(xy[0].x, xy[0].y)
  ctx.lineTo(xy[0].x + ux * t, xy[0].y + uy * t)
  ctx.stroke()
}

function drawArrowHead(ctx: CanvasRenderingContext2D, from: XY, to: XY, size = 9) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x)
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - size * Math.cos(ang - 0.45), to.y - size * Math.sin(ang - 0.45))
  ctx.lineTo(to.x - size * Math.cos(ang + 0.45), to.y - size * Math.sin(ang + 0.45))
  ctx.closePath()
  ctx.fillStyle = ctx.strokeStyle as string
  ctx.fill()
}

function drawArrow(ctx: CanvasRenderingContext2D, xy: XY[], up?: boolean, down?: boolean) {
  if (xy.length < 2) return
  drawSegment(ctx, xy)
  if (up) {
    const mid = { x: (xy[0].x + xy[1].x) / 2, y: Math.min(xy[0].y, xy[1].y) }
    drawArrowHead(ctx, { x: mid.x, y: mid.y + 14 }, mid, 10)
  } else if (down) {
    const mid = { x: (xy[0].x + xy[1].x) / 2, y: Math.max(xy[0].y, xy[1].y) }
    drawArrowHead(ctx, { x: mid.x, y: mid.y - 14 }, mid, 10)
  } else {
    drawArrowHead(ctx, xy[0], xy[1])
  }
}

function drawRect(
  ctx: CanvasRenderingContext2D,
  xy: XY[],
  fill: string | null,
  selected: boolean,
) {
  if (xy.length < 2) return
  const x = Math.min(xy[0].x, xy[1].x)
  const y = Math.min(xy[0].y, xy[1].y)
  const w = Math.abs(xy[1].x - xy[0].x)
  const h = Math.abs(xy[1].y - xy[0].y)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fillRect(x, y, w, h)
  }
  ctx.strokeRect(x, y, w, h)
  if (selected) {
    drawHandles(ctx, [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ], true)
  }
}

function drawCircle(ctx: CanvasRenderingContext2D, xy: XY[], fill: string | null, selected: boolean) {
  if (xy.length < 2) return
  const cx = (xy[0].x + xy[1].x) / 2
  const cy = (xy[0].y + xy[1].y) / 2
  const rx = Math.abs(xy[1].x - xy[0].x) / 2
  const ry = Math.abs(xy[1].y - xy[0].y) / 2
  ctx.beginPath()
  ctx.ellipse(cx, cy, Math.max(rx, 2), Math.max(ry, 2), 0, 0, Math.PI * 2)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  ctx.stroke()
  if (selected) drawHandles(ctx, [xy[0], xy[1]], true)
}

function drawPolyline(ctx: CanvasRenderingContext2D, xy: XY[]) {
  if (xy.length < 2) return
  ctx.beginPath()
  ctx.moveTo(xy[0].x, xy[0].y)
  for (let i = 1; i < xy.length; i++) ctx.lineTo(xy[i].x, xy[i].y)
  ctx.stroke()
}

function drawMultiPattern(
  ctx: CanvasRenderingContext2D,
  xy: XY[],
  toolId: string,
  selected: boolean,
) {
  drawPolyline(ctx, xy)
  if (xy.length >= 2) {
    ctx.beginPath()
    ctx.moveTo(xy[0].x, xy[0].y)
    for (let i = 1; i < xy.length; i++) ctx.lineTo(xy[i].x, xy[i].y)
    ctx.setLineDash([3, 3])
    ctx.globalAlpha = 0.45
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }
  const labels = PATTERN_LABELS[toolId]
  ctx.font = FONT
  ctx.fillStyle = selected ? SEL : '#d1d4dc'
  xy.forEach((p, i) => {
    const label = labels?.[i] ?? String(i + 1)
    ctx.fillText(label, p.x + 6, p.y - 6)
    ctx.beginPath()
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = selected ? SEL : '#2962FF'
    ctx.fill()
    ctx.fillStyle = selected ? SEL : '#d1d4dc'
  })
  if (selected) drawHandles(ctx, xy, true)
}

function drawParallelChannel(ctx: CanvasRenderingContext2D, xy: XY[], selected: boolean) {
  if (xy.length < 3) {
    if (xy.length >= 2) drawSegment(ctx, xy)
    return
  }
  const [a, b, c] = xy
  const dx = b.x - a.x
  const dy = b.y - a.y
  const c2 = { x: c.x + dx, y: c.y + dy }
  drawSegment(ctx, [a, b])
  drawSegment(ctx, [c, c2])
  drawSegment(ctx, [a, c])
  drawSegment(ctx, [b, c2])
  if (selected) drawHandles(ctx, [a, b, c], true)
}

function drawPitchfork(ctx: CanvasRenderingContext2D, xy: XY[], chartW: number, selected: boolean) {
  if (xy.length < 3) return
  const [a, b, c] = xy
  const mid = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 }
  drawSegment(ctx, [a, mid])
  const slope = Math.atan2(c.y - b.y, c.x - b.x)
  const perp = slope + Math.PI / 2
  const t = chartW
  for (const origin of [b, c, mid]) {
    ctx.beginPath()
    ctx.moveTo(origin.x, origin.y)
    ctx.lineTo(origin.x + Math.cos(perp) * t, origin.y + Math.sin(perp) * t)
    ctx.lineTo(origin.x - Math.cos(perp) * t, origin.y - Math.sin(perp) * t)
    ctx.stroke()
  }
  if (selected) drawHandles(ctx, [a, b, c], true)
}

function drawLongShort(
  ctx: CanvasRenderingContext2D,
  xy: XY[],
  points: Drawing['points'],
  kind: 'long' | 'short',
  selected: boolean,
) {
  if (xy.length < 2 || points.length < 2) return
  const isLong = kind === 'long'
  const color = isLong ? '#26a69a' : '#ef5350'
  const fill = isLong ? 'rgba(38,166,154,0.14)' : 'rgba(239,83,80,0.14)'
  stroke(ctx, color, 1.5, selected)
  drawRect(ctx, xy, fill, false)
  const entry = points[0].price
  const exit = points[1].price
  const risk = Math.abs(exit - entry)
  const target = isLong ? entry + risk : entry - risk
  const midX = (xy[0].x + xy[1].x) / 2
  ctx.font = FONT
  ctx.fillStyle = color
  ctx.fillText(`Entrada ${formatMeasurePrice(entry)}`, midX, xy[0].y - 8)
  ctx.fillText(`Alvo ${formatMeasurePrice(target)}`, midX, (isLong ? Math.min(xy[0].y, xy[1].y) : Math.max(xy[0].y, xy[1].y)) - 8)
  if (selected) drawHandles(ctx, xy, true)
}

function drawFan(ctx: CanvasRenderingContext2D, xy: XY[], chartW: number) {
  if (xy.length < 2) return
  const [a, b] = xy
  const levels = [0.382, 0.5, 0.618, 1]
  for (const lvl of levels) {
    const end = { x: a.x + (b.x - a.x) * lvl, y: a.y + (b.y - a.y) * lvl }
    const ang = Math.atan2(end.y - a.y, end.x - a.x)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(a.x + Math.cos(ang) * chartW, a.y + Math.sin(ang) * chartW)
    ctx.stroke()
  }
}

function drawSine(ctx: CanvasRenderingContext2D, xy: XY[]) {
  if (xy.length < 2) return
  const steps = 48
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = xy[0].x + (xy[1].x - xy[0].x) * t
    const midY = (xy[0].y + xy[1].y) / 2
    const amp = Math.abs(xy[1].y - xy[0].y) / 2
    const y = midY + Math.sin(t * Math.PI * 3) * amp
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

function drawVolumeProfile(ctx: CanvasRenderingContext2D, xy: XY[], selected: boolean) {
  if (xy.length < 2) return
  const x = Math.min(xy[0].x, xy[1].x)
  const y = Math.min(xy[0].y, xy[1].y)
  const w = Math.abs(xy[1].x - xy[0].x)
  const h = Math.abs(xy[1].y - xy[0].y)
  ctx.fillStyle = 'rgba(41,98,255,0.08)'
  ctx.fillRect(x, y, w, h)
  ctx.strokeRect(x, y, w, h)
  const bars = 10
  for (let i = 0; i < bars; i++) {
    const bh = h * (0.25 + Math.sin(i * 1.1) * 0.2 + 0.35)
    const bx = x + (w / bars) * i + 1
    const bw = w / bars - 2
    ctx.fillStyle = 'rgba(41,98,255,0.35)'
    ctx.fillRect(bx, y + h - bh, bw, bh)
  }
  if (selected) drawHandles(ctx, [xy[0], xy[1]], true)
}

function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  xy: XY[],
  kind: RenderKind,
  text: string | undefined,
  selected: boolean,
) {
  if (!xy[0]) return
  const p = xy[0]
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  if (kind === 'marker') {
    ctx.fillStyle = selected ? SEL : '#ef5350'
    ctx.beginPath()
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  if (kind === 'flag') {
    ctx.strokeStyle = selected ? SEL : '#2962FF'
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x, p.y - 28)
    ctx.stroke()
    ctx.fillStyle = selected ? SEL : '#2962FF'
    ctx.fillRect(p.x, p.y - 28, 22, 14)
    return
  }
  const label = text ?? (kind === 'note' ? 'Nota' : kind === 'callout' ? 'Comentário' : '')
  if (kind === 'callout') {
    ctx.fillStyle = 'rgba(19,23,34,0.92)'
    const tw = ctx.measureText(label).width + 16
    ctx.fillRect(p.x, p.y - 28, tw, 22)
    ctx.strokeStyle = selected ? SEL : 'rgba(255,255,255,0.15)'
    ctx.strokeRect(p.x, p.y - 28, tw, 22)
    ctx.beginPath()
    ctx.moveTo(p.x + 8, p.y - 6)
    ctx.lineTo(p.x + 4, p.y)
    ctx.lineTo(p.x + 16, p.y - 6)
    ctx.fill()
  } else if (kind === 'note') {
    ctx.fillStyle = 'rgba(240,185,11,0.92)'
    ctx.fillRect(p.x, p.y - 32, 72, 40)
    ctx.strokeStyle = selected ? SEL : 'rgba(0,0,0,0.2)'
    ctx.strokeRect(p.x, p.y - 32, 72, 40)
  }
  ctx.fillStyle = kind === 'note' ? '#131722' : selected ? SEL : '#e5e7eb'
  ctx.fillText(label, p.x + 8, p.y - 12)
  if (selected) drawHandles(ctx, [p], true)
}

function renderByKind(
  ctx: CanvasRenderingContext2D,
  kind: RenderKind,
  drawing: Drawing,
  xy: XY[],
  mapper: CoordinateMapper,
  chartW: number,
  chartH: number,
  selected: boolean,
  previewMode: boolean,
) {
  const toolId = drawing.toolId ?? drawingTypeToToolId(drawing.type)
  const spec = getToolSpec(toolId)
  const color = drawing.style.color || spec?.defaultColor || '#2962FF'
  const lw = drawing.style.lineWidth || 1.5
  const fill =
    spec?.fillOpacity != null
      ? `rgba(${color === '#26a69a' ? '38,166,154' : color === '#ef5350' ? '239,83,80' : '41,98,255'},${spec.fillOpacity})`
      : drawing.style.fill ?? null

  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  stroke(ctx, color, lw, selected)

  switch (kind) {
    case 'fib':
      renderFibRetracement(
        ctx,
        mapper,
        drawing.points,
        drawing.fib,
        drawing.style,
        chartW,
        chartH,
        selected,
        null,
        previewMode,
      )
      break
    case 'fibExtension':
    case 'fibChannel':
    case 'fibTime':
      renderFibRetracement(ctx, mapper, drawing.points, drawing.fib, drawing.style, chartW, chartH, selected, null, previewMode)
      break
    case 'hline':
      if (xy[0]) {
        ctx.beginPath()
        ctx.moveTo(0, xy[0].y)
        ctx.lineTo(chartW, xy[0].y)
        ctx.stroke()
        if (selected) drawHandles(ctx, [xy[0]], true)
      }
      break
    case 'vline':
      if (xy[0]) {
        ctx.beginPath()
        ctx.moveTo(xy[0].x, 0)
        ctx.lineTo(xy[0].x, chartH)
        ctx.stroke()
        if (selected) drawHandles(ctx, [xy[0]], true)
      }
      break
    case 'hlineRay':
      if (xy[0]) {
        ctx.beginPath()
        ctx.moveTo(xy[0].x, xy[0].y)
        ctx.lineTo(chartW, xy[0].y)
        ctx.stroke()
        if (selected) drawHandles(ctx, [xy[0]], true)
      }
      break
    case 'cross':
      if (xy[0]) {
        ctx.beginPath()
        ctx.moveTo(0, xy[0].y)
        ctx.lineTo(chartW, xy[0].y)
        ctx.moveTo(xy[0].x, 0)
        ctx.lineTo(xy[0].x, chartH)
        ctx.stroke()
        if (selected) drawHandles(ctx, [xy[0]], true)
      }
      break
    case 'ray':
      drawRay(ctx, xy, chartW, chartH)
      if (selected) drawHandles(ctx, xy.slice(0, 2), true)
      break
    case 'extended':
      drawExtended(ctx, xy, chartW)
      if (selected) drawHandles(ctx, xy.slice(0, 2), true)
      break
    case 'rectangle':
    case 'highlighter':
      drawRect(ctx, xy, fill ?? (kind === 'highlighter' ? 'rgba(240,185,11,0.22)' : 'rgba(41,98,255,0.06)'), selected)
      break
    case 'circle':
      drawCircle(ctx, xy, fill ?? 'rgba(41,98,255,0.06)', selected)
      break
    case 'ellipse':
      drawCircle(ctx, xy, fill ?? 'rgba(41,98,255,0.06)', selected)
      break
    case 'arrow':
      drawArrow(ctx, xy)
      if (selected) drawHandles(ctx, xy.slice(0, 2), true)
      break
    case 'arrowUp':
      drawArrow(ctx, xy, true)
      if (selected) drawHandles(ctx, xy.slice(0, 2), true)
      break
    case 'arrowDown':
      drawArrow(ctx, xy, false, true)
      if (selected) drawHandles(ctx, xy.slice(0, 2), true)
      break
    case 'polyline':
    case 'brush':
      drawPolyline(ctx, xy)
      if (selected && xy.length) drawHandles(ctx, xy, true)
      break
    case 'multi':
      drawMultiPattern(ctx, xy, toolId, selected)
      break
    case 'parallelChannel':
      drawParallelChannel(ctx, xy, selected)
      break
    case 'pitchfork':
      drawPitchfork(ctx, xy, chartW, selected)
      break
    case 'long':
      drawLongShort(ctx, xy, drawing.points, 'long', selected)
      break
    case 'short':
      drawLongShort(ctx, xy, drawing.points, 'short', selected)
      break
    case 'fan':
    case 'gannFan':
      drawFan(ctx, xy, chartW)
      if (selected) drawHandles(ctx, xy.slice(0, 2), true)
      break
    case 'arcs':
      drawCircle(ctx, xy, null, selected)
      drawCircle(ctx, [{ x: xy[0].x, y: xy[0].y }, { x: xy[0].x + (xy[1].x - xy[0].x) * 0.618, y: xy[0].y + (xy[1].y - xy[0].y) * 0.618 }], null, false)
      break
    case 'sine':
      drawSine(ctx, xy)
      if (selected) drawHandles(ctx, xy.slice(0, 2), true)
      break
    case 'cyclic':
      if (xy.length >= 2) {
        const x0 = Math.min(xy[0].x, xy[1].x)
        const x1 = Math.max(xy[0].x, xy[1].x)
        const span = (x1 - x0) / 4
        for (let i = 0; i <= 4; i++) {
          const x = x0 + span * i
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, chartH)
          ctx.stroke()
        }
        if (selected) drawHandles(ctx, xy.slice(0, 2), true)
      }
      break
    case 'volumeProfile':
      drawVolumeProfile(ctx, xy, selected)
      break
    case 'vwap':
      if (xy[0]) {
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(0, xy[0].y)
        ctx.lineTo(chartW, xy[0].y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.font = FONT
        ctx.fillStyle = color
        ctx.fillText('VWAP', xy[0].x + 8, xy[0].y - 6)
        if (selected) drawHandles(ctx, [xy[0]], true)
      }
      break
    case 'gannBox':
      drawRect(ctx, xy, 'rgba(120,123,134,0.06)', selected)
      if (xy.length >= 2) {
        const x0 = Math.min(xy[0].x, xy[1].x)
        const y0 = Math.min(xy[0].y, xy[1].y)
        const w = Math.abs(xy[1].x - xy[0].x)
        const h = Math.abs(xy[1].y - xy[0].y)
        for (let i = 1; i < 4; i++) {
          ctx.beginPath()
          ctx.moveTo(x0, y0 + (h / 4) * i)
          ctx.lineTo(x0 + w, y0 + (h / 4) * i)
          ctx.moveTo(x0 + (w / 4) * i, y0)
          ctx.lineTo(x0 + (w / 4) * i, y0 + h)
          ctx.stroke()
        }
      }
      break
    case 'text':
      if (xy[0]) {
        ctx.fillStyle = selected ? SEL : '#e5e7eb'
        ctx.fillText(drawing.text ?? '', xy[0].x + 4, xy[0].y - 4)
        if (selected) drawHandles(ctx, [xy[0]], true)
      }
      break
    case 'note':
    case 'callout':
    case 'flag':
    case 'marker':
      drawAnnotation(ctx, xy, kind, drawing.text, selected)
      break
    case 'ruler':
    case 'segment':
    default:
      if (xy.length >= 2) {
        drawSegment(ctx, xy)
        if (selected) drawHandles(ctx, [xy[0], xy[1]], true)
      }
      break
  }
  ctx.restore()
}

export function renderToolDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  mapper: CoordinateMapper,
  chartW: number,
  chartH: number,
  selected: boolean,
  previewMode = false,
) {
  const toolId = drawing.toolId ?? drawingTypeToToolId(drawing.type)
  const spec = getToolSpec(toolId)
  const pts = drawing.points
  const xy = mapper.pointsToXY(pts)
  if (!xy.length) return

  if (spec?.renderKind === 'fib' || drawing.type === 'fibonacci') {
    renderFibRetracement(
      ctx,
      mapper,
      pts,
      drawing.fib,
      drawing.style,
      chartW,
      chartH,
      selected,
      null,
      previewMode,
    )
    return
  }

  if (drawing.type === 'ruler') return

  const kind = spec?.renderKind ?? 'segment'
  renderByKind(ctx, kind, drawing, xy, mapper, chartW, chartH, selected, previewMode)
}
