'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useSidebar } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  SIDEBAR_EDGE_ZONE_PX,
  suppressMainNavSwipeFor,
} from '@/hooks/swipe-gesture-coordination'

/** Movimento horizontal mínimo para contar como swipe. */
const MIN_DELTA_X = 50
/** Igual à ideia do swipe de navegação: movimento mais vertical que horizontal cancela. */
const VERTICAL_DOMINANCE = 0.55

function isHorizontalDominant(dx: number, dy: number): boolean {
  return Math.abs(dy) <= Math.abs(dx) * VERTICAL_DOMINANCE
}

function shouldIgnoreOpenTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true
  if (target.closest('button, a, input, textarea, select, [data-no-sidebar-swipe]')) return true
  if (target.closest('[data-slot="dialog-content"], [role="dialog"]')) return true
  return false
}

function cleanupWindowListeners(
  move: (e: PointerEvent) => void,
  up: (e: PointerEvent) => void
) {
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', up)
  window.removeEventListener('pointercancel', up)
}

/**
 * Mobile: borda esquerda + deslizar para a direita abre o drawer do menu.
 * Usa Pointer Events (touch + rato). Cancela se o gesto ficar mais vertical que horizontal.
 */
export function useSidebarEdgeOpenPointerHandlers(): Pick<
  React.ComponentProps<'main'>,
  'onPointerDownCapture'
> {
  const isMobile = useIsMobile()
  const { openMobile, setOpenMobile } = useSidebar()
  const sessionRef = useRef<{
    x0: number
    y0: number
    pointerId: number
    cancelled: boolean
  } | null>(null)

  const onPointerDownCapture = useCallback(
    (e: React.PointerEvent<HTMLMainElement>) => {
      if (!isMobile || openMobile) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (e.clientX > SIDEBAR_EDGE_ZONE_PX) return
      if (shouldIgnoreOpenTarget(e.target)) return

      sessionRef.current = {
        x0: e.clientX,
        y0: e.clientY,
        pointerId: e.pointerId,
        cancelled: false,
      }

      const onMove = (ev: PointerEvent) => {
        const s = sessionRef.current
        if (!s || ev.pointerId !== s.pointerId || s.cancelled) return
        const dx = ev.clientX - s.x0
        const dy = ev.clientY - s.y0
        if (Math.abs(dy) > Math.abs(dx) * VERTICAL_DOMINANCE) {
          s.cancelled = true
          cleanupWindowListeners(onMove, onUp)
          sessionRef.current = null
        }
      }

      const onUp = (ev: PointerEvent) => {
        const s = sessionRef.current
        if (!s || ev.pointerId !== s.pointerId) return
        cleanupWindowListeners(onMove, onUp)
        sessionRef.current = null
        if (s.cancelled) return

        const dx = ev.clientX - s.x0
        const dy = ev.clientY - s.y0
        if (dx >= MIN_DELTA_X && isHorizontalDominant(dx, dy)) {
          setOpenMobile(true)
          suppressMainNavSwipeFor(450)
        }
      }

      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [isMobile, openMobile, setOpenMobile]
  )

  useEffect(() => {
    return () => {
      sessionRef.current = null
    }
  }, [])

  return { onPointerDownCapture }
}

/**
 * Mobile com menu aberto: deslizar para a esquerda no overlay ou no painel fecha o drawer.
 */
export function useMobileSidebarSwipeCloseHandlers(
  openMobile: boolean,
  setOpenMobile: (open: boolean) => void,
  isMobile: boolean
) {
  const sessionRef = useRef<{
    x0: number
    y0: number
    pointerId: number
    cancelled: boolean
  } | null>(null)

  const onPointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      if (!openMobile || !isMobile) return
      if (e.pointerType === 'mouse' && e.button !== 0) return

      sessionRef.current = {
        x0: e.clientX,
        y0: e.clientY,
        pointerId: e.pointerId,
        cancelled: false,
      }

      const onMove = (ev: PointerEvent) => {
        const s = sessionRef.current
        if (!s || ev.pointerId !== s.pointerId || s.cancelled) return
        const dx = ev.clientX - s.x0
        const dy = ev.clientY - s.y0
        if (Math.abs(dy) > Math.abs(dx) * VERTICAL_DOMINANCE) {
          s.cancelled = true
          cleanupWindowListeners(onMove, onUp)
          sessionRef.current = null
        }
      }

      const onUp = (ev: PointerEvent) => {
        const s = sessionRef.current
        if (!s || ev.pointerId !== s.pointerId) return
        cleanupWindowListeners(onMove, onUp)
        sessionRef.current = null
        if (s.cancelled) return

        const dx = ev.clientX - s.x0
        const dy = ev.clientY - s.y0
        if (dx <= -MIN_DELTA_X && isHorizontalDominant(dx, dy)) {
          setOpenMobile(false)
        }
      }

      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [openMobile, isMobile, setOpenMobile]
  )

  useEffect(() => {
    if (!openMobile) sessionRef.current = null
    return undefined
  }, [openMobile])

  return { onPointerDownCapture }
}
