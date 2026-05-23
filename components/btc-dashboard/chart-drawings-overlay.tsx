'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useChartDrawings } from '@/components/btc-dashboard/chart-drawings-context'
import {
  FIB_LEVELS,
  getDrawingGeometry,
  getRequiredPointCount,
  isClickToAddGeometry,
  isDragToCompleteGeometry,
  isSingleClickGeometry,
} from '@/lib/btc/chart-drawing-geometry'
import { drawRulerMeasure } from '@/lib/btc/chart-drawings-render'
import { getDrawingTool } from '@/lib/btc/chart-drawings-config'
import type { ChartPoint, DrawingDraft, PlacedDrawing } from '@/lib/btc/chart-drawing-types'
import type { OhlcvBar } from '@/lib/btc/types'
import type { Time } from 'lightweight-charts'

const STROKE = '#2962ff'
const STROKE_SEL = '#f0b90b'
const FILL_LONG = 'rgba(38, 166, 154, 0.2)'
const FILL_SHORT = 'rgba(239, 83, 80, 0.2)'

type XY = { x: number; y: number }

function findNearestBar(bars: OhlcvBar[], time: number): OhlcvBar | null {
  if (!bars.length) return null
  let best = bars[0]
  let bestD = Math.abs(best.time - time)
  for (const b of bars) {
    const d = Math.abs(b.time - time)
    if (d < bestD) {
      best = b
      bestD = d
    }
  }
  return best
}

function snapPoint(pt: ChartPoint, bars: OhlcvBar[], magnet: boolean): ChartPoint {
  if (!magnet || !bars.length) return pt
  const bar = findNearestBar(bars, pt.time)
  if (!bar) return pt
  const candidates = [bar.open, bar.high, bar.low, bar.close]
  let price = pt.price
  let min = Infinity
  for (const c of candidates) {
    const d = Math.abs(c - pt.price)
    if (d < min) {
      min = d
      price = c
    }
  }
  return { time: bar.time, price }
}

const HIT_PX = 14

function pixelDist(
  p0: ChartPoint,
  p1: ChartPoint,
  toXY: (p: ChartPoint) => XY | null,
): number {
  const a = toXY(p0)
  const b = toXY(p1)
  if (!a || !b) return 0
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export function ChartDrawingsOverlay({ bars }: { bars: OhlcvBar[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draggingRef = useRef(false)
  const {
    mainChart,
    instances,
    draft,
    setDraft,
    commitDraft,
    activeToolId,
    drawingsVisible,
    drawingsLocked,
    weakMagnet,
    selectedId,
    removeInstance,
    requestRedraw,
    redrawVersion,
    setBars,
  } = useChartDrawings()

  useEffect(() => {
    setBars(bars)
  }, [bars, setBars])

  const toXY = useCallback(
    (pt: ChartPoint): XY | null => {
      if (!mainChart) return null
      const { chart, series } = mainChart
      const x = chart.timeScale().timeToCoordinate(pt.time as Time)
      const y = series.priceToCoordinate(pt.price)
      if (x == null || y == null) return null
      return { x, y }
    },
    [mainChart],
  )

  const fromXY = useCallback(
    (x: number, y: number): ChartPoint | null => {
      if (!mainChart) return null
      const { chart, series } = mainChart
      const time = chart.timeScale().coordinateToTime(x)
      const price = series.coordinateToPrice(y)
      if (time == null || price == null) return null
      return snapPoint({ time: time as number, price }, bars, weakMagnet)
    },
    [mainChart, bars, weakMagnet],
  )

  const extendLine = (a: XY, b: XY, w: number, h: number): [XY, XY] => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return [a, b]
    const len = Math.hypot(dx, dy)
    const ux = dx / len
    const uy = dy / len
    const scale = Math.max(w, h) * 2
    return [
      { x: a.x - ux * scale, y: a.y - uy * scale },
      { x: b.x + ux * scale, y: b.y + uy * scale },
    ]
  }

  const drawShape = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      d: PlacedDrawing | DrawingDraft,
      selected: boolean,
      w: number,
      h: number,
    ) => {
      const pts =
        'preview' in d && d.preview !== undefined ? [...d.points, d.preview] : d.points
      const xy = pts.map((p) => toXY(p)).filter((p): p is XY => p != null)
      if (!xy.length) return

      ctx.strokeStyle = selected ? STROKE_SEL : STROKE
      ctx.fillStyle = selected ? 'rgba(240, 185, 11, 0.08)' : 'rgba(41, 98, 255, 0.06)'
      ctx.lineWidth = selected ? 2 : 1.5

      const geom = d.geometry

      if (geom === 'horizontal' && xy.length >= 1) {
        ctx.beginPath()
        ctx.moveTo(0, xy[0].y)
        ctx.lineTo(w, xy[0].y)
        ctx.stroke()
        return
      }

      if (geom === 'vertical' && xy.length >= 1) {
        ctx.beginPath()
        ctx.moveTo(xy[0].x, 0)
        ctx.lineTo(xy[0].x, h)
        ctx.stroke()
        return
      }

      if (geom === 'cross' && xy.length >= 1) {
        ctx.beginPath()
        ctx.moveTo(0, xy[0].y)
        ctx.lineTo(w, xy[0].y)
        ctx.moveTo(xy[0].x, 0)
        ctx.lineTo(xy[0].x, h)
        ctx.stroke()
        return
      }

      if (geom === 'rectangle' && xy.length >= 2) {
        const x = Math.min(xy[0].x, xy[1].x)
        const y = Math.min(xy[0].y, xy[1].y)
        const rw = Math.abs(xy[1].x - xy[0].x)
        const rh = Math.abs(xy[1].y - xy[0].y)
        ctx.fillRect(x, y, rw, rh)
        ctx.strokeRect(x, y, rw, rh)
        return
      }

      if (geom === 'circle' && xy.length >= 2) {
        const cx = (xy[0].x + xy[1].x) / 2
        const cy = (xy[0].y + xy[1].y) / 2
        const rx = Math.abs(xy[1].x - xy[0].x) / 2
        const ry = Math.abs(xy[1].y - xy[0].y) / 2
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        return
      }

      if (geom === 'fib' && xy.length >= 2) {
        const y0 = xy[0].y
        const y1 = xy[1].y
        const x0 = Math.min(xy[0].x, xy[1].x)
        const x1 = Math.max(xy[0].x, xy[1].x)
        for (const lvl of FIB_LEVELS) {
          const y = y0 + (y1 - y0) * (1 - lvl)
          ctx.beginPath()
          ctx.moveTo(x0, y)
          ctx.lineTo(x1, y)
          ctx.stroke()
          ctx.font = '10px sans-serif'
          ctx.fillStyle = '#9ca3af'
          ctx.fillText(`${(lvl * 100).toFixed(1)}%`, x1 + 4, y + 3)
          ctx.fillStyle = selected ? 'rgba(240, 185, 11, 0.08)' : 'rgba(41, 98, 255, 0.06)'
        }
        return
      }

      if (geom === 'fibFan' && xy.length >= 2) {
        const origin = xy[0]
        const end = xy[1]
        for (let i = 1; i <= 5; i++) {
          const t = i / 5
          const ex = origin.x + (end.x - origin.x) * t
          const ey = origin.y + (end.y - origin.y) * t
          const [a, b] = extendLine(origin, { x: ex, y: ey }, w, h)
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
        return
      }

      if (geom === 'long' && xy.length >= 2) {
        const x = Math.min(xy[0].x, xy[1].x)
        const top = Math.min(xy[0].y, xy[1].y)
        const bottom = Math.max(xy[0].y, xy[1].y)
        const rw = Math.abs(xy[1].x - xy[0].x)
        const entry = xy[0].y
        ctx.fillStyle = FILL_LONG
        ctx.fillRect(x, top, rw, entry - top)
        ctx.fillStyle = 'rgba(38, 166, 154, 0.35)'
        ctx.fillRect(x, entry, rw, bottom - entry)
        ctx.strokeStyle = selected ? STROKE_SEL : '#26a69a'
        ctx.strokeRect(x, top, rw, bottom - top)
        return
      }

      if (geom === 'short' && xy.length >= 2) {
        const x = Math.min(xy[0].x, xy[1].x)
        const top = Math.min(xy[0].y, xy[1].y)
        const bottom = Math.max(xy[0].y, xy[1].y)
        const rw = Math.abs(xy[1].x - xy[0].x)
        const entry = xy[0].y
        ctx.fillStyle = FILL_SHORT
        ctx.fillRect(x, entry, rw, bottom - entry)
        ctx.fillStyle = 'rgba(239, 83, 80, 0.35)'
        ctx.fillRect(x, top, rw, entry - top)
        ctx.strokeStyle = selected ? STROKE_SEL : '#ef5350'
        ctx.strokeRect(x, top, rw, bottom - top)
        return
      }

      if (geom === 'arrow' && xy.length >= 2) {
        const [a, b] = xy
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        const ang = Math.atan2(b.y - a.y, b.x - a.x)
        const head = 10
        ctx.beginPath()
        ctx.moveTo(b.x, b.y)
        ctx.lineTo(b.x - head * Math.cos(ang - 0.4), b.y - head * Math.sin(ang - 0.4))
        ctx.lineTo(b.x - head * Math.cos(ang + 0.4), b.y - head * Math.sin(ang + 0.4))
        ctx.closePath()
        ctx.fillStyle = selected ? STROKE_SEL : STROKE
        ctx.fill()
        return
      }

      if ((geom === 'brush' || geom === 'polyline' || geom === 'multi') && xy.length >= 2) {
        ctx.beginPath()
        ctx.moveTo(xy[0].x, xy[0].y)
        for (let i = 1; i < xy.length; i++) ctx.lineTo(xy[i].x, xy[i].y)
        ctx.stroke()
        for (const p of xy) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
          ctx.fillStyle = selected ? STROKE_SEL : STROKE
          ctx.fill()
        }
        return
      }

      if (geom === 'parallelChannel' && xy.length >= 3) {
        const [a, b, c] = xy
        const dx = b.x - a.x
        const dy = b.y - a.y
        const offX = c.x - a.x
        const offY = c.y - a.y
        const [l1a, l1b] = extendLine(a, b, w, h)
        ctx.beginPath()
        ctx.moveTo(l1a.x, l1a.y)
        ctx.lineTo(l1b.x, l1b.y)
        ctx.stroke()
        const a2 = { x: a.x + offX, y: a.y + offY }
        const b2 = { x: b.x + offX, y: b.y + offY }
        const [l2a, l2b] = extendLine(a2, b2, w, h)
        ctx.beginPath()
        ctx.moveTo(l2a.x, l2a.y)
        ctx.lineTo(l2b.x, l2b.y)
        ctx.stroke()
        return
      }

      if (geom === 'pitchfork' && xy.length >= 3) {
        const [a, b, c] = xy
        const mid = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 }
        const [ma, mb] = extendLine(a, mid, w, h)
        ctx.beginPath()
        ctx.moveTo(ma.x, ma.y)
        ctx.lineTo(mb.x, mb.y)
        ctx.stroke()
        const [l1a, l1b] = extendLine(a, b, w, h)
        const [l2a, l2b] = extendLine(a, c, w, h)
        ctx.beginPath()
        ctx.moveTo(l1a.x, l1a.y)
        ctx.lineTo(l1b.x, l1b.y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(l2a.x, l2a.y)
        ctx.lineTo(l2b.x, l2b.y)
        ctx.stroke()
        return
      }

      if (geom === 'text' && xy.length >= 1) {
        const label = 'text' in d && d.text ? d.text : 'text' in d ? (d as PlacedDrawing).label : 'Texto'
        ctx.font = '12px sans-serif'
        ctx.fillStyle = '#e5e7eb'
        ctx.fillText(label, xy[0].x + 4, xy[0].y - 4)
        return
      }

      if (geom === 'ruler' && xy.length >= 2) {
        const [a, b] = xy
        const p0 = pts[0] as ChartPoint
        const p1 = pts[1] as ChartPoint
        drawRulerMeasure(ctx, a, b, p0, p1, bars, w, selected)
        return
      }

      if (xy.length >= 2) {
        let a = xy[0]
        let b = xy[1]
        if (geom === 'ray') {
          ;[a, b] = extendLine(a, b, w, h)
        } else if (geom === 'extended' || geom === 'fibExtension') {
          ;[a, b] = extendLine(a, b, w, h)
        } else if (geom === 'horizontalRay') {
          b = { x: w, y: a.y }
        }
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      for (const p of xy) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'
        ctx.fill()
        ctx.strokeStyle = selected ? STROKE_SEL : STROKE
        ctx.stroke()
      }
    },
    [toXY, instances, selectedId, bars],
  )

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !mainChart) return
    const rect = mainChart.container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = Math.floor(rect.width)
    const h = Math.floor(rect.height)
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    if (!drawingsVisible) return

    for (const inst of instances) {
      drawShape(ctx, inst, inst.id === selectedId, w, h)
    }
    if (draft) drawShape(ctx, draft, true, w, h)
  }, [mainChart, instances, draft, selectedId, drawingsVisible, drawShape, redrawVersion])

  useEffect(() => {
    paint()
  }, [paint])

  useEffect(() => {
    if (!mainChart) return
    const { chart } = mainChart
    const redraw = () => requestAnimationFrame(paint)
    chart.timeScale().subscribeVisibleLogicalRangeChange(redraw)
    const ro = new ResizeObserver(redraw)
    ro.observe(mainChart.container)
    return () => {
      ro.disconnect()
    }
  }, [mainChart, paint])

  const hitTest = useCallback(
    (x: number, y: number): string | null => {
      let best: { id: string; d: number } | null = null
      for (const inst of [...instances].reverse()) {
        const xy = inst.points.map((p) => toXY(p)).filter((p): p is XY => p != null)
        if (xy.length < 1) continue
        let d = Infinity
        if (inst.geometry === 'horizontal' && xy[0]) d = Math.abs(y - xy[0].y)
        else if (inst.geometry === 'vertical' && xy[0]) d = Math.abs(x - xy[0].x)
        else if (xy.length >= 2) d = distToSegment(x, y, xy[0].x, xy[0].y, xy[1].x, xy[1].y)
        else if (xy[0]) d = Math.hypot(x - xy[0].x, y - xy[0].y)
        if (d < HIT_PX && (!best || d < best.d)) best = { id: inst.id, d }
      }
      return best?.id ?? null
    },
    [instances, toXY],
  )

  const finishDraft = useCallback(
    (d: DrawingDraft) => {
      if (d.geometry === 'text' && d.points.length === 1) {
        const t = window.prompt('Texto', d.label)
        if (!t) {
          setDraft(null)
          return
        }
        commitDraft({ ...d, label: t, points: d.points })
        return
      }
      commitDraft(d)
    },
    [commitDraft, setDraft],
  )

  const handlePointer = useCallback(
    (clientX: number, clientY: number, type: 'down' | 'move' | 'up') => {
      if (!mainChart || drawingsLocked) return
      const rect = mainChart.container.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const pt = fromXY(x, y)
      if (!pt && type !== 'up') return

      const tool = activeToolId ? getDrawingTool(activeToolId) : null
      const geom = activeToolId ? getDrawingGeometry(activeToolId) : 'select'

      if (type === 'down') {
        if (!activeToolId || !tool) return

        if (geom === 'erase') {
          const hit = hitTest(x, y)
          if (hit) removeInstance(hit)
          return
        }

        if (geom === 'brush') {
          draggingRef.current = true
          setDraft({
            toolId: tool.id,
            label: tool.label,
            geometry: geom,
            points: [pt!],
            preview: pt!,
          })
          return
        }

        if (isSingleClickGeometry(geom)) {
          finishDraft({
            toolId: tool.id,
            label: tool.label,
            geometry: geom,
            points: [pt!],
          })
          return
        }

        if (isDragToCompleteGeometry(geom)) {
          draggingRef.current = true
          setDraft({
            toolId: tool.id,
            label: tool.label,
            geometry: geom,
            points: [pt!],
            preview: pt!,
          })
          return
        }

        if (!draft) {
          setDraft({
            toolId: tool.id,
            label: tool.label,
            geometry: geom,
            points: [pt!],
            preview: pt!,
          })
          return
        }

        const nextPts = [...draft.points, pt!]
        const need = getRequiredPointCount(draft.geometry, draft.toolId)
        if (!isClickToAddGeometry(draft.geometry) && nextPts.length >= need) {
          finishDraft({ ...draft, points: nextPts })
        } else {
          setDraft({ ...draft, points: nextPts, preview: pt! })
        }
        return
      }

      if (type === 'move') {
        if (!draft || !pt) return
        if (draft.geometry === 'brush') {
          const last = draft.points[draft.points.length - 1]
          if (!last || last.time !== pt.time || last.price !== pt.price) {
            setDraft({ ...draft, points: [...draft.points, pt], preview: pt })
          }
          return
        }
        if (draggingRef.current || draft.preview) {
          setDraft({ ...draft, preview: pt })
        }
        return
      }

      if (type === 'up') {
        if (draft?.geometry === 'brush' && draft.points.length >= 2) {
          draggingRef.current = false
          finishDraft({ ...draft, points: draft.points })
          return
        }

        if (draggingRef.current && draft) {
          draggingRef.current = false
          const start = draft.points[0]
          const end = pt ?? draft.preview
          if (!end) {
            setDraft(null)
            return
          }
          if (pixelDist(start, end, toXY) < 8) {
            setDraft(null)
            return
          }
          finishDraft({ ...draft, points: [start, end] })
        }
      }
    },
    [
      mainChart,
      drawingsLocked,
      fromXY,
      toXY,
      activeToolId,
      draft,
      setDraft,
      finishDraft,
      hitTest,
      removeInstance,
    ],
  )

  const interactive = Boolean(activeToolId)
  const cursor =
    activeToolId === 'eraser'
      ? 'cell'
      : activeToolId === 'ruler'
        ? 'crosshair'
        : interactive
          ? 'crosshair'
          : 'default'

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[5]"
      style={{ pointerEvents: interactive ? 'auto' : 'none', cursor }}
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
        handlePointer(e.clientX, e.clientY, 'down')
      }}
      onPointerMove={(e) => handlePointer(e.clientX, e.clientY, 'move')}
      onPointerUp={(e) => {
        handlePointer(e.clientX, e.clientY, 'up')
        ;(e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId)
      }}
      onDoubleClick={() => {
        if (!draft) return
        if (draft.geometry === 'polyline' || draft.geometry === 'multi') {
          if (draft.points.length >= 2) finishDraft(draft)
        }
      }}
    />
  )
}
