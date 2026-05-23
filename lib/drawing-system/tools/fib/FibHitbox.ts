import type { XY } from '@/lib/drawing-system/core/coordinate-mapper'
import { distToSegment } from '@/lib/drawing-system/core/hit-test'
import type { ChartPoint, Drawing, HitResult } from '@/lib/drawing-system/types'
import { computeFibLevels, fibTimeBounds, resolveFibData } from '@/lib/drawing-system/tools/fib/FibMath'

const HIT_LINE = 10
const HIT_HANDLE = 9

export type FibHitContext = {
  points: ChartPoint[]
  xy: XY[]
  toXY: (pt: ChartPoint) => XY | null
  chartW: number
}

function horizontalSpan(
  ctx: FibHitContext,
  timeMin: number,
  timeMax: number,
  price: number,
  extendRight: boolean,
): { x0: number; x1: number; y: number } | null {
  const a = ctx.toXY({ time: timeMin, price })
  const b = ctx.toXY({ time: timeMax, price })
  if (!a || !b) return null
  const y = a.y
  const x0 = Math.min(a.x, b.x)
  const x1 = extendRight ? ctx.chartW : Math.max(a.x, b.x)
  return { x0, x1, y }
}

export function hitTestFib(
  px: number,
  py: number,
  drawing: Drawing,
  ctx: FibHitContext,
  selectedId: string | null,
): HitResult {
  if (drawing.type !== 'fibonacci' || ctx.xy.length < 2) return null

  const [p0, p1] = ctx.points
  const [xy0, xy1] = ctx.xy
  const fib = resolveFibData(drawing.fib)
  const { timeMin, timeMax } = fibTimeBounds(p0, p1)
  const threshold = drawing.id === selectedId ? HIT_LINE + 4 : HIT_LINE

  let best: HitResult = null

  for (let i = 0; i < 2; i++) {
    const h = ctx.xy[i]
    const dist = Math.hypot(px - h.x, py - h.y)
    if (dist <= HIT_HANDLE && (!best || dist < best.distance)) {
      best = { kind: 'handle', drawingId: drawing.id, handleIndex: i, distance: dist }
    }
  }

  const levels = computeFibLevels(p0, p1, fib)
  for (const lvl of levels) {
    const span = horizontalSpan(ctx, timeMin, timeMax, lvl.price, fib.extendRight !== false)
    if (!span) continue
    const dist = distToSegment(px, py, span.x0, span.y, span.x1, span.y)
    if (dist <= threshold && (!best || (best.kind !== 'handle' && dist < best.distance))) {
      best = { kind: 'fib-line', drawingId: drawing.id, levelIndex: lvl.index, distance: dist }
    }
  }

  if (fib.showTrendLine !== false) {
    const dist = distToSegment(px, py, xy0.x, xy0.y, xy1.x, xy1.y)
    if (dist <= threshold && (!best || (best.kind !== 'handle' && dist < best.distance))) {
      best = { kind: 'body', drawingId: drawing.id, distance: dist }
    }
  }

  if (!best && levels.length >= 2) {
    const ys = levels.map((l) => horizontalSpan(ctx, timeMin, timeMax, l.price, fib.extendRight !== false)?.y).filter((y): y is number => y != null)
    if (ys.length >= 2) {
      const top = Math.min(...ys)
      const bottom = Math.max(...ys)
      const x0 = Math.min(xy0.x, xy1.x)
      const x1 = fib.extendRight !== false ? ctx.chartW : Math.max(xy0.x, xy1.x)
      if (px >= x0 && px <= x1 && py >= top && py <= bottom) {
        best = { kind: 'body', drawingId: drawing.id, distance: 0 }
      }
    }
  }

  return best
}
