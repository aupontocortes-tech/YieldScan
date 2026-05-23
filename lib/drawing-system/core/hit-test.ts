import type { Drawing, DrawingType } from '@/lib/drawing-system/types'
import type { XY } from '@/lib/drawing-system/core/coordinate-mapper'
import type { HitResult } from '@/lib/drawing-system/types'
import { hitTestFib } from '@/lib/drawing-system/tools/fib/FibHitbox'
import { getToolSpec } from '@/lib/drawing-system/tools/tool-specs'

const HIT_LINE = 10
const HIT_HANDLE = 9

export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function getHandles(type: DrawingType, xy: XY[], toolId?: string): XY[] {
  const spec = toolId ? getToolSpec(toolId) : null
  if (spec?.renderKind === 'multi' || spec?.renderKind === 'polyline') return xy
  if (type === 'horizontalLine' && xy[0]) return [xy[0]]
  if (type === 'verticalLine' && xy[0]) return [xy[0]]
  if (type === 'rectangle' && xy.length >= 2) {
    const x0 = Math.min(xy[0].x, xy[1].x)
    const x1 = Math.max(xy[0].x, xy[1].x)
    const y0 = Math.min(xy[0].y, xy[1].y)
    const y1 = Math.max(xy[0].y, xy[1].y)
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ]
  }
  return xy
}

function bodyDistance(type: DrawingType, px: number, py: number, xy: XY[], toolId?: string): number {
  const spec = toolId ? getToolSpec(toolId) : null
  if (spec?.renderKind === 'circle' || spec?.renderKind === 'ellipse') {
    if (xy.length < 2) return Infinity
    const cx = (xy[0].x + xy[1].x) / 2
    const cy = (xy[0].y + xy[1].y) / 2
    const rx = Math.abs(xy[1].x - xy[0].x) / 2
    const ry = Math.abs(xy[1].y - xy[0].y) / 2
    const inside =
      ((px - cx) ** 2) / (rx * rx + 0.01) + ((py - cy) ** 2) / (ry * ry + 0.01) <= 1
    if (inside) return 0
    return Math.min(
      Math.abs(Math.hypot(px - cx, py - cy) - Math.max(rx, ry)),
      distToSegment(px, py, xy[0].x, xy[0].y, xy[1].x, xy[1].y),
    )
  }
  if (!xy.length) return Infinity
  if (type === 'horizontalLine' && xy[0]) return Math.abs(py - xy[0].y)
  if (type === 'verticalLine' && xy[0]) return Math.abs(px - xy[0].x)
  if (type === 'rectangle' && xy.length >= 2) {
    const x0 = Math.min(xy[0].x, xy[1].x)
    const x1 = Math.max(xy[0].x, xy[1].x)
    const y0 = Math.min(xy[0].y, xy[1].y)
    const y1 = Math.max(xy[0].y, xy[1].y)
    const inside = px >= x0 && px <= x1 && py >= y0 && py <= y1
    if (inside) return 0
    const dl = px - x0
    const dr = x1 - px
    const dt = py - y0
    const db = y1 - py
    return Math.min(Math.abs(dl), Math.abs(dr), Math.abs(dt), Math.abs(db))
  }
  if (type === 'text' && xy[0]) {
    return Math.hypot(px - xy[0].x, py - xy[0].y)
  }
  if (type === 'brush' && xy.length >= 2) {
    let best = Infinity
    for (let i = 1; i < xy.length; i++) {
      best = Math.min(best, distToSegment(px, py, xy[i - 1].x, xy[i - 1].y, xy[i].x, xy[i].y))
    }
    return best
  }
  if (xy.length >= 3) {
    let best = Infinity
    for (let i = 1; i < xy.length; i++) {
      best = Math.min(best, distToSegment(px, py, xy[i - 1].x, xy[i - 1].y, xy[i].x, xy[i].y))
    }
    const x0 = Math.min(...xy.map((p) => p.x))
    const x1 = Math.max(...xy.map((p) => p.x))
    const y0 = Math.min(...xy.map((p) => p.y))
    const y1 = Math.max(...xy.map((p) => p.y))
    if (px >= x0 && px <= x1 && py >= y0 && py <= y1) return Math.min(best, 0)
    return best
  }
  if (xy.length >= 2) return distToSegment(px, py, xy[0].x, xy[0].y, xy[1].x, xy[1].y)
  return Math.hypot(px - xy[0].x, py - xy[0].y)
}

export function hitTestDrawings(
  px: number,
  py: number,
  drawings: Drawing[],
  toXY: (points: Drawing['points']) => XY[],
  selectedId: string | null,
  chartW = 0,
  toPointXY?: (pt: { time: number; price: number }) => XY | null,
): HitResult {
  const ordered = [...drawings].sort((a, b) => b.zIndex - a.zIndex)
  let best: HitResult = null

  for (const d of ordered) {
    if (!d.visible) continue
    const xy = toXY(d.points)
    if (!xy.length) continue

    if (d.type === 'fibonacci' && toPointXY && chartW > 0) {
      const fibHit = hitTestFib(px, py, d, {
        points: d.points,
        xy,
        toXY: toPointXY,
        chartW,
      }, selectedId)
      if (fibHit && (!best || fibHit.distance < best.distance)) {
        best = fibHit
      }
      continue
    }

    const handles = getHandles(d.type, xy, d.toolId)
    for (let i = 0; i < handles.length; i++) {
      const h = handles[i]
      const dist = Math.hypot(px - h.x, py - h.y)
      if (dist <= HIT_HANDLE && (!best || dist < best.distance)) {
        best = { kind: 'handle', drawingId: d.id, handleIndex: i, distance: dist }
      }
    }

    const bd = bodyDistance(d.type, px, py, xy, d.toolId)
    const threshold = d.id === selectedId ? HIT_LINE + 4 : HIT_LINE
    if (bd <= threshold && (!best || (best.kind !== 'handle' && bd < best.distance))) {
      best = { kind: 'body', drawingId: d.id, distance: bd }
    }
  }

  if (best?.kind === 'handle') return best
  if (best?.kind === 'fib-line') return best
  if (best?.kind === 'body') return best
  return null
}
