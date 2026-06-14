'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useChartDrawings } from '@/components/btc-dashboard/chart-drawings-context'
import { CoordinateMapper } from '@/lib/drawing-system/core/coordinate-mapper'
import { DrawingManager } from '@/lib/drawing-system/core/drawing-manager'
import { PointerEngine } from '@/lib/drawing-system/events/pointer-engine'
import { getGesturePreview } from '@/lib/drawing-system/events/gesture-preview'
import { renderCanvas } from '@/lib/drawing-system/renderers/canvas-renderer'
import { EMPTY_DRAWINGS, useDrawingStore } from '@/lib/drawing-system/store/drawing-store'
import { resolveToolMode } from '@/lib/drawing-system/tools/tool-registry'
import { hitTestDrawings } from '@/lib/drawing-system/core/hit-test'
import type { OhlcvBar } from '@/lib/btc/types'

type ContextMenuState = { x: number; y: number; drawingId: string } | null

export function DrawingSystemOverlay({ bars }: { bars: OhlcvBar[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapperRef = useRef<CoordinateMapper | null>(null)
  const engineRef = useRef<PointerEngine | null>(null)
  const managerRef = useRef<DrawingManager | null>(null)
  const capturingRef = useRef(false)
  const rafRef = useRef(0)

  const { mainChart } = useChartDrawings()
  const [menu, setMenu] = useState<ContextMenuState>(null)

  const revision = useDrawingStore((s) => s.revision)
  const activeToolId = useDrawingStore((s) => s.activeToolId)
  const selectedId = useDrawingStore((s) => s.selectedId)
  const prefs = useDrawingStore((s) => s.prefs)

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const mapper = mapperRef.current
    const api = mainChart
    if (!canvas || !mapper || !api) return

    const rect = api.container.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const store = useDrawingStore.getState()
    const livePreview = getGesturePreview()
    engineRef.current?.setChartWidth(w)

    renderCanvas(
      ctx,
      w,
      h,
      dpr,
      mapper,
      {
        scopeKey: store.scopeKey,
        byScope: store.byScope,
        prefs: store.prefs,
        draft: store.draft,
        transient: livePreview ?? store.transient,
      },
      store.selectedId,
      store.hoveredId,
      bars,
      store.hoveredFibLevelIndex,
    )
  }, [mainChart, bars])

  const schedulePaint = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(paint)
  }, [paint])

  const startCapturePaintLoop = useCallback(() => {
    const loop = () => {
      if (!capturingRef.current) return
      paint()
      rafRef.current = requestAnimationFrame(loop)
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }, [paint])

  const stopCapturePaintLoop = useCallback(() => {
    capturingRef.current = false
    cancelAnimationFrame(rafRef.current)
    schedulePaint()
  }, [schedulePaint])

  useEffect(() => {
    schedulePaint()
  }, [revision, selectedId, prefs, mainChart, bars, schedulePaint])

  useEffect(() => {
    const api = mainChart
    if (!api) return

    mapperRef.current = new CoordinateMapper(api, bars, prefs.weakMagnet)
    engineRef.current = new PointerEngine(mapperRef.current, bars)
    managerRef.current = new DrawingManager(useDrawingStore.getState())

    const { chart, container } = api

    const onRange = () => {
      mapperRef.current?.refreshLogicalMap()
      useDrawingStore.getState().bumpRevision()
    }
    const ts = chart.timeScale()
    ts.subscribeVisibleLogicalRangeChange(onRange)

    const ro = new ResizeObserver(() => schedulePaint())
    ro.observe(container)

    return () => {
      ts.unsubscribeVisibleLogicalRangeChange(onRange)
      ro.disconnect()
      mapperRef.current = null
      engineRef.current = null
    }
  }, [mainChart, bars, prefs.weakMagnet, schedulePaint])

  useEffect(() => {
    mapperRef.current?.setMagnet(prefs.weakMagnet)
    engineRef.current?.setBars(bars)
    mapperRef.current?.setBars(bars)
  }, [bars, prefs.weakMagnet])

  useEffect(() => {
    const api = mainChart
    const engine = engineRef.current
    if (!api || !engine) return

    const container = api.container

    const onMove = (e: PointerEvent) => {
      if (capturingRef.current) e.preventDefault()
      engine.handlePointerMove(e.clientX, e.clientY, container)
    }

    const onUp = (e: PointerEvent) => {
      try {
        if (container.hasPointerCapture(e.pointerId)) {
          container.releasePointerCapture(e.pointerId)
        }
      } catch {
        /* ignore */
      }
      engine.handlePointerUp(e.clientX, e.clientY, container)
      capturingRef.current = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      stopCapturePaintLoop()
    }

    const onDownCapture = (e: PointerEvent) => {
      if (e.button !== 0) return
      setMenu(null)
      const handled = engine.handlePointerDown(e.clientX, e.clientY, container)
      if (handled) {
        capturingRef.current = true
        e.preventDefault()
        e.stopPropagation()
        try {
          container.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        window.addEventListener('pointermove', onMove, { passive: false })
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
        startCapturePaintLoop()
      }
    }

    const onHoverMove = (e: PointerEvent) => {
      if (capturingRef.current) return
      const store = useDrawingStore.getState()
      const mode = resolveToolMode(store.activeToolId)
      const pendingDrag2 =
        store.transient.draft?.points.length === 1 &&
        store.transient.draft.toolId &&
        store.transient.draft.toolId === store.activeToolId
      if ((mode === 'draw' || mode === 'erase') && !pendingDrag2) return
      engine.handlePointerMove(e.clientX, e.clientY, container)
      schedulePaint()
    }

    const onContextMenu = (e: MouseEvent) => {
      const store = useDrawingStore.getState()
      if (store.prefs.drawingsLocked) return
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const mapper = mapperRef.current
      if (!mapper) return
      const drawings = store.getDrawings().filter((d) => d.visible)
      const hit = hitTestDrawings(
        x,
        y,
        drawings,
        (pts) => mapper.pointsToXY(pts),
        store.selectedId,
        rect.width,
        (pt) => mapper.toXY(pt),
      )
      if (!hit) return
      e.preventDefault()
      store.select(hit.drawingId)
      setMenu({ x: e.clientX, y: e.clientY, drawingId: hit.drawingId })
    }

    container.addEventListener('pointerdown', onDownCapture, true)
    container.addEventListener('pointermove', onHoverMove, { passive: true })
    container.addEventListener('contextmenu', onContextMenu)

    return () => {
      container.removeEventListener('pointerdown', onDownCapture, true)
      container.removeEventListener('pointermove', onHoverMove)
      container.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [mainChart, schedulePaint, startCapturePaintLoop, stopCapturePaintLoop])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return

      const store = useDrawingStore.getState()
      const manager = managerRef.current ?? new DrawingManager(store)

      if (e.key === 'Enter') {
        const engine = engineRef.current
        if (engine?.commitPolylineDraft()) {
          capturingRef.current = false
          cancelAnimationFrame(rafRef.current)
          schedulePaint()
          e.preventDefault()
        }
        return
      }

      if (e.key === 'Escape') {
        if (store.transient.draft || store.transient.move) {
          engineRef.current?.cancelDraft()
          capturingRef.current = false
          cancelAnimationFrame(rafRef.current)
          schedulePaint()
          e.preventDefault()
        } else if (store.draft) {
          store.setDraft(null)
          e.preventDefault()
        } else if (store.activeToolId) {
          store.setActiveTool(null)
          e.preventDefault()
        } else if (store.selectedId) {
          store.select(null)
          e.preventDefault()
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedId && !store.prefs.drawingsLocked) {
          manager.removeSelected()
          e.preventDefault()
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        store.undo()
        e.preventDefault()
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        store.redo()
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [schedulePaint])

  const mode = resolveToolMode(activeToolId)
  const chartCursor =
    mode === 'erase' || mode === 'draw' ? 'crosshair' : selectedId ? 'default' : undefined

  useEffect(() => {
    const chart = mainChart?.chart
    const container = mainChart?.container
    if (!chart || !container) return
    const block = mode === 'draw' || mode === 'erase'
    chart.applyOptions({
      handleScroll: !block,
      handleScale: !block,
      kineticScroll: { touch: !block, mouse: !block },
    })
    if (block) container.style.touchAction = 'none'
    else container.style.removeProperty('touch-action')
    return () => {
      chart.applyOptions({
        handleScroll: true,
        handleScale: true,
        kineticScroll: { touch: true, mouse: true },
      })
      container.style.removeProperty('touch-action')
    }
  }, [mainChart, mode])

  useEffect(() => {
    const el = mainChart?.container
    if (!el) return
    if (chartCursor) el.style.cursor = chartCursor
    else el.style.removeProperty('cursor')
    return () => {
      el.style.removeProperty('cursor')
    }
  }, [mainChart, chartCursor])

  if (!mainChart) return null

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-[15]"
        aria-hidden
      />
      {menu && (
        <DrawingContextMenu
          x={menu.x}
          y={menu.y}
          drawingId={menu.drawingId}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
}

function DrawingContextMenu({
  x,
  y,
  drawingId,
  onClose,
}: {
  x: number
  y: number
  drawingId: string
  onClose: () => void
}) {
  const drawing = useDrawingStore((s) => {
    const list = s.byScope[s.scopeKey]?.drawings ?? EMPTY_DRAWINGS
    return list.find((d) => d.id === drawingId)
  })

  useEffect(() => {
    const close = () => onClose()
    window.addEventListener('pointerdown', close, { once: true })
    return () => window.removeEventListener('pointerdown', close)
  }, [onClose])

  if (!drawing) return null

  return (
    <div
      className="fixed z-[100] min-w-[160px] rounded-lg border border-white/10 bg-[#1c1c1e] py-1 shadow-xl"
      style={{ left: x, top: y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <MenuBtn
        label="Eliminar"
        onClick={() => {
          useDrawingStore.getState().removeDrawing(drawingId)
          onClose()
        }}
      />
      <MenuBtn
        label={drawing.locked ? 'Desbloquear' : 'Bloquear'}
        onClick={() => {
          useDrawingStore.getState().toggleDrawingLock(drawingId)
          onClose()
        }}
      />
      <MenuBtn
        label={drawing.visible ? 'Ocultar' : 'Mostrar'}
        onClick={() => {
          useDrawingStore.getState().toggleDrawingVisible(drawingId)
          onClose()
        }}
      />
    </div>
  )
}

function MenuBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="block w-full px-3 py-2 text-left text-[13px] text-zinc-200 hover:bg-white/10"
      onClick={onClick}
    >
      {label}
    </button>
  )
}
