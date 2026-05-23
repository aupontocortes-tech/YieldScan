import type { CoordinateMapper, XY } from '@/lib/drawing-system/core/coordinate-mapper'
import type { ChartPoint, Drawing } from '@/lib/drawing-system/types'
import {
  computeFibLevels,
  fibBandFill,
  fibTimeBounds,
  formatFibLabel,
  resolveFibData,
} from '@/lib/drawing-system/tools/fib/FibMath'

const SEL = '#f0b90b'
const LINE = '#787B86'
const LABEL_BG = 'rgba(19, 23, 34, 0.88)'
const FONT =
  '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif'

const textWidthCache = new Map<string, number>()

function measureLabel(ctx: CanvasRenderingContext2D, text: string): number {
  const cached = textWidthCache.get(text)
  if (cached != null) return cached
  const w = ctx.measureText(text).width
  textWidthCache.set(text, w)
  if (textWidthCache.size > 500) textWidthCache.clear()
  return w
}

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

type LabelSlot = { y: number; text: string; ratio: number; price: number }

/** Evita sobreposição vertical de labels (estilo TradingView). */
function layoutLabels(slots: LabelSlot[], minGap = 3): LabelSlot[] {
  const sorted = [...slots].sort((a, b) => a.y - b.y)
  const lh = 16
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    if (cur.y - prev.y < lh + minGap) {
      sorted[i] = { ...cur, y: prev.y + lh + minGap }
    }
  }
  return sorted
}

function drawHandles(ctx: CanvasRenderingContext2D, xy: XY[], selected: boolean) {
  const stroke = selected ? SEL : '#2962FF'
  for (const p of xy) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#131722'
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

export function renderFibRetracement(
  ctx: CanvasRenderingContext2D,
  mapper: CoordinateMapper,
  points: ChartPoint[],
  fibData: Drawing['fib'],
  style: Drawing['style'],
  chartW: number,
  chartH: number,
  selected: boolean,
  hoveredLevelIndex: number | null,
  previewMode = false,
) {
  if (points.length < 2) return

  const p0 = points[0]
  const p1 = points[1]
  const xy0 = mapper.toXY(p0)
  const xy1 = mapper.toXY(p1)
  if (!xy0 || !xy1) return

  const fib = resolveFibData(fibData)
  const { timeMin, timeMax } = fibTimeBounds(p0, p1)
  const levels = computeFibLevels(p0, p1, fib)

  const xAnchorA = mapper.toXY({ time: timeMin, price: p0.price })
  const xAnchorB = mapper.toXY({ time: timeMax, price: p0.price })
  if (!xAnchorA || !xAnchorB) return

  const xLeft = Math.min(xAnchorA.x, xAnchorB.x, xy0.x, xy1.x)
  const xRight = fib.extendRight !== false ? chartW - 2 : Math.max(xy0.x, xy1.x, xAnchorA.x, xAnchorB.x)

  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  const defaultColor = selected ? SEL : style.color || LINE
  const defaultWidth = selected ? Math.max(style.lineWidth, 1.5) : style.lineWidth || 1

  const levelLines: { y: number; x0: number; x1: number; index: number; ratio: number; price: number }[] = []

  for (const lvl of levels) {
    const pt = mapper.toXY({ time: timeMin, price: lvl.price })
    if (!pt) continue
    levelLines.push({
      y: pt.y,
      x0: xLeft,
      x1: xRight,
      index: lvl.index,
      ratio: lvl.ratio,
      price: lvl.price,
    })
  }

  if (fib.showBackground !== false && levelLines.length >= 2) {
    for (let i = 0; i < levelLines.length - 1; i++) {
      const top = levelLines[i]
      const bottom = levelLines[i + 1]
      const y0 = Math.min(top.y, bottom.y)
      const y1 = Math.max(top.y, bottom.y)
      ctx.fillStyle = fibBandFill(i, selected)
      ctx.fillRect(xLeft, y0, xRight - xLeft, y1 - y0)
    }
  }

  if (fib.showTrendLine !== false) {
    ctx.beginPath()
    ctx.moveTo(xy0.x, xy0.y)
    ctx.lineTo(xy1.x, xy1.y)
    ctx.strokeStyle = selected ? SEL : 'rgba(120, 123, 134, 0.85)'
    ctx.lineWidth = selected ? 1.5 : 1
    ctx.setLineDash([4, 3])
    ctx.stroke()
    ctx.setLineDash([])
  }

  for (const line of levelLines) {
    const isHover = hoveredLevelIndex === line.index
    const lvlConfig = fib.levels[line.index]
    const stroke = lvlConfig?.color ?? defaultColor
    const lw = lvlConfig?.lineWidth ?? (isHover ? defaultWidth + 0.5 : defaultWidth)

    ctx.beginPath()
    ctx.moveTo(line.x0, line.y)
    ctx.lineTo(line.x1, line.y)
    ctx.strokeStyle = isHover ? SEL : stroke
    ctx.lineWidth = lw
    ctx.stroke()
  }

  if (!previewMode) {
    ctx.font = FONT
    const padX = 6
    const labelH = 16
    const labelSlots: LabelSlot[] = levelLines.map((l) => ({
      y: l.y,
      text: formatFibLabel(l.ratio, l.price),
      ratio: l.ratio,
      price: l.price,
    }))

    const laidOut = layoutLabels(labelSlots)
    const maxTextW = Math.max(...laidOut.map((s) => measureLabel(ctx, s.text)), 60)
    const boxW = maxTextW + padX * 2

    for (const slot of laidOut) {
      const line = levelLines.find((l) => l.ratio === slot.ratio)!
      const text = formatFibLabel(line.ratio, line.price)
      const tw = measureLabel(ctx, text)
      const bx = Math.min(chartW - boxW - 4, xRight - boxW)
      const by = Math.max(4, Math.min(chartH - labelH - 4, slot.y - labelH / 2))

      ctx.fillStyle = LABEL_BG
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      roundRect(ctx, bx, by, tw + padX * 2, labelH, 3)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = selected || hoveredLevelIndex === line.index ? SEL : '#d1d4dc'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillText(text, bx + padX, by + labelH / 2)
    }
  } else if (levelLines.length >= 2) {
    drawHandles(ctx, [xy0, xy1], true)
  }

  if (selected && !previewMode && levelLines.length) {
    drawHandles(ctx, [xy0, xy1], true)
    const ys = [...levelLines.map((l) => l.y), xy0.y, xy1.y]
    const top = Math.min(...ys)
    const bottom = Math.max(...ys)
    ctx.strokeStyle = 'rgba(240, 185, 11, 0.45)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.strokeRect(xLeft, top, xRight - xLeft, bottom - top)
    ctx.setLineDash([])
  }

  ctx.restore()
}
