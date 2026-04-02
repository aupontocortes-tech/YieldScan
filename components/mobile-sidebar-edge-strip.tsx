'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSidebar } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  MOBILE_SIDEBAR_DRAWER_PX,
  SIDEBAR_EDGE_ZONE_PX,
  suppressMainNavSwipeFor,
} from '@/hooks/swipe-gesture-coordination'

const MIN_OPEN_DELTA_PX = 50
/** Só “trava” o gesto horizontal depois de algum movimento (evita confundir com toque). */
const LOCK_HORIZ_PX = 10
const VERTICAL_DOMINANCE = 0.55

function cleanupWindowListeners(
  move: (e: PointerEvent) => void,
  up: (e: PointerEvent) => void
) {
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', up)
  window.removeEventListener('pointercancel', up)
}

function isHorizontalDominant(dx: number, dy: number): boolean {
  return Math.abs(dy) <= Math.abs(dx) * VERTICAL_DOMINANCE
}

/**
 * Faixa fixa invisível na borda esquerda + pré-visualização do drawer ao arrastar.
 * Resolve abertura por swipe quando o gesto não chega ao &lt;main&gt; (filhos interativos / scroll).
 */
export function MobileSidebarEdgeOpenStrip() {
  const isMobile = useIsMobile()
  const { openMobile, setOpenMobile } = useSidebar()
  const [mounted, setMounted] = useState(false)
  const [dragRevealPx, setDragRevealPx] = useState<number | null>(null)
  const stripRef = useRef<HTMLDivElement | null>(null)
  const sessionRef = useRef<{
    x0: number
    y0: number
    pointerId: number
    locked: boolean
    cancelled: boolean
  } | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingRevealRef = useRef(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  const flushReveal = useCallback(() => {
    rafRef.current = null
    setDragRevealPx(pendingRevealRef.current)
  }, [])

  const scheduleReveal = useCallback(
    (px: number) => {
      pendingRevealRef.current = px
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushReveal)
      }
    },
    [flushReveal]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isMobile || openMobile) return
      if (e.pointerType === 'mouse' && e.button !== 0) return

      const el = stripRef.current
      if (!el) return

      e.preventDefault()
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }

      sessionRef.current = {
        x0: e.clientX,
        y0: e.clientY,
        pointerId: e.pointerId,
        locked: false,
        cancelled: false,
      }
      pendingRevealRef.current = 0
      setDragRevealPx(0)

      const onMove = (ev: PointerEvent) => {
        const s = sessionRef.current
        if (!s || ev.pointerId !== s.pointerId || s.cancelled) return

        const dx = ev.clientX - s.x0
        const dy = ev.clientY - s.y0

        if (!s.locked) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_HORIZ_PX) return
          if (Math.abs(dy) > Math.abs(dx) * (1 / VERTICAL_DOMINANCE)) {
            s.cancelled = true
            cleanupWindowListeners(onMove, onUp)
            sessionRef.current = null
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
            rafRef.current = null
            setDragRevealPx(null)
            try {
              el.releasePointerCapture(ev.pointerId)
            } catch {
              /* ignore */
            }
            return
          }
          s.locked = true
        }

        const reveal = Math.min(MOBILE_SIDEBAR_DRAWER_PX, Math.max(0, dx))
        scheduleReveal(reveal)
      }

      const onUp = (ev: PointerEvent) => {
        const s = sessionRef.current
        if (!s || ev.pointerId !== s.pointerId) return
        cleanupWindowListeners(onMove, onUp)
        sessionRef.current = null
        try {
          el.releasePointerCapture(ev.pointerId)
        } catch {
          /* ignore */
        }

        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }

        if (s.cancelled) {
          setDragRevealPx(null)
          return
        }

        const dx = ev.clientX - s.x0
        const dy = ev.clientY - s.y0

        if (dx >= MIN_OPEN_DELTA_PX && isHorizontalDominant(dx, dy)) {
          suppressMainNavSwipeFor(450)
          setOpenMobile(true)
        }
        setDragRevealPx(null)
      }

      window.addEventListener('pointermove', onMove, { passive: false })
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [isMobile, openMobile, scheduleReveal, setOpenMobile]
  )

  useEffect(() => {
    return () => {
      sessionRef.current = null
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  if (!isMobile || openMobile) return null

  const edgeHitStrip = (
    <div
      ref={stripRef}
      role="presentation"
      aria-hidden
      data-mobile-sidebar-edge=""
      className="touch-none fixed inset-y-0 left-0 z-[30]"
      style={{ width: SIDEBAR_EDGE_ZONE_PX }}
      onPointerDown={onPointerDown}
    />
  )

  const preview =
    dragRevealPx != null && dragRevealPx > 0 ? (
      <>
        <div
          role="presentation"
          className="fixed inset-0 z-[46] bg-black/60 touch-none"
          style={{
            opacity: Math.min(1, (dragRevealPx / MOBILE_SIDEBAR_DRAWER_PX) * 0.95),
            transition: 'none',
          }}
        />
        <div
          role="presentation"
          className="bg-sidebar text-sidebar-foreground fixed top-0 bottom-0 left-0 z-[47] flex w-[18rem] flex-col border-r border-sidebar-border shadow-xl touch-none"
          style={{
            transform: `translateX(${-MOBILE_SIDEBAR_DRAWER_PX + dragRevealPx}px)`,
            transition: 'none',
            willChange: 'transform',
          }}
        />
      </>
    ) : null

  if (!mounted) return edgeHitStrip

  return (
    <>
      {edgeHitStrip}
      {preview ? createPortal(preview, document.body) : null}
    </>
  )
}
