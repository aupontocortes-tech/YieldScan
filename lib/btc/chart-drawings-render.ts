import { computeMeasure, measureLabelLines } from '@/lib/btc/chart-measure'
import type { ChartPoint } from '@/lib/btc/chart-drawing-types'
import type { OhlcvBar } from '@/lib/btc/types'

type XY = { x: number; y: number }

const FONT = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

/** Régua / medição — visual TradingView (linha + extremos + caixa de estatísticas). */
export function drawRulerMeasure(
  ctx: CanvasRenderingContext2D,
  a: XY,
  b: XY,
  p0: ChartPoint,
  p1: ChartPoint,
  bars: OhlcvBar[],
  chartWidth: number,
  selected: boolean,
) {
  const up = p1.price >= p0.price
  const color = up ? '#26a69a' : '#ef5350'
  const stats = computeMeasure(p0, p1, bars, b.x - a.x, b.y - a.y)
  const lines = measureLabelLines(stats)

  const ang = Math.atan2(b.y - a.y, b.x - a.x)
  const perp = ang + Math.PI / 2
  const capLen = 5

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = selected ? 2 : 1.5
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()

  for (const p of [a, b]) {
    ctx.beginPath()
    ctx.moveTo(p.x + Math.cos(perp) * capLen, p.y + Math.sin(perp) * capLen)
    ctx.lineTo(p.x - Math.cos(perp) * capLen, p.y - Math.sin(perp) * capLen)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = '#131722'
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const lh = 14
  const padX = 8
  const padY = 6

  ctx.font = FONT
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width))
  const boxW = textW + padX * 2
  const boxH = lines.length * lh + padY * 2

  let bx = mx - boxW / 2
  let by = my - boxH - 12
  if (by < 4) by = my + 12
  if (bx < 4) bx = 4
  if (bx + boxW > chartWidth - 4) {
    bx = chartWidth - boxW - 4
  }

  ctx.fillStyle = 'rgba(19, 23, 34, 0.94)'
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.lineWidth = 1
  roundRect(ctx, bx, by, boxW, boxH, 4)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  lines.forEach((line, i) => {
    ctx.fillText(line, bx + padX, by + padY + lh * i + lh / 2)
  })

  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
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
