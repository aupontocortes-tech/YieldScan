'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MOBILE_SIDEBAR_DRAWER_PX } from '@/hooks/swipe-gesture-coordination'

const MIN_DELTA_CLOSE_PX = 50
const VERTICAL_DOMINANCE = 0.55
const LOCK_HORIZ_PX = 10

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
 * Mobile com menu aberto: deslizar para a esquerda no overlay ou no painel fecha o drawer.
 * Durante o gesto, o painel e o overlay acompanham o dedo (translateX / opacidade).
 */
export function useMobileSidebarSwipeCloseHandlers(
  openMobile: boolean,
  setOpenMobile: (open: boolean) => void,
  isMobile: boolean
) {
  const [dragX, setDragX] = useState(0)
  const rafRef = useRef<number | null>(null)
  const pendingDragRef = useRef(0)
  const sessionRef = useRef<{
    x0: number
    y0: number
    pointerId: number
    locked: boolean
    cancelled: boolean
  } | null>(null)

  const flushDrag = useCallback(() => {
    rafRef.current = null
    setDragX(pendingDragRef.current)
  }, [])

  const scheduleDrag = useCallback(
    (x: number) => {
      pendingDragRef.current = x
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushDrag)
      }
    },
    [flushDrag]
  )

  useEffect(() => {
    if (!openMobile) {
      setDragX(0)
      sessionRef.current = null
    }
  }, [openMobile])

  const onPointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      if (!openMobile || !isMobile) return
      if (e.pointerType === 'mouse' && e.button !== 0) return

      sessionRef.current = {
        x0: e.clientX,
        y0: e.clientY,
        pointerId: e.pointerId,
        locked: false,
        cancelled: false,
      }

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
            setDragX(0)
            return
          }
          s.locked = true
        }

        const tx = Math.max(-MOBILE_SIDEBAR_DRAWER_PX, Math.min(0, dx))
        scheduleDrag(tx)
      }

      const onUp = (ev: PointerEvent) => {
        const s = sessionRef.current
        if (!s || ev.pointerId !== s.pointerId) return
        cleanupWindowListeners(onMove, onUp)
        sessionRef.current = null

        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }

        if (s.cancelled) {
          setDragX(0)
          return
        }

        const dx = ev.clientX - s.x0
        const dy = ev.clientY - s.y0

        if (dx <= -MIN_DELTA_CLOSE_PX && isHorizontalDominant(dx, dy)) {
          setOpenMobile(false)
        }
        setDragX(0)
      }

      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [openMobile, isMobile, scheduleDrag, setOpenMobile]
  )

  const dragging = dragX !== 0

  const contentStyle: React.CSSProperties | undefined = dragging
    ? {
        transform: `translateX(${dragX}px)`,
        transition: 'none',
        willChange: 'transform',
      }
    : undefined

  const overlayStyle: React.CSSProperties | undefined = dragging
    ? {
        opacity: Math.max(0.2, 1 + dragX / MOBILE_SIDEBAR_DRAWER_PX),
        transition: 'none',
      }
    : undefined

  const contentClassName = dragging ? '!duration-0 !transition-none' : undefined
  const overlayClassName = dragging ? '!duration-0 !transition-none' : undefined

  return {
    onPointerDownCapture,
    contentStyle,
    overlayStyle,
    contentClassName,
    overlayClassName,
  }
}
