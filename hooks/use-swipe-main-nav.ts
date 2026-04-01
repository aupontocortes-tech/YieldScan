'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_HORIZONTAL_PX = 72
/** Gestos mais horizontais que verticais (evita confundir com scroll). */
const VERTICAL_RATIO = 0.55
const MAX_DURATION_MS = 480

function useIsMobileNavWidth() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return mobile
}

/**
 * Mobile: deslizar para a direita → Dashboard (/).
 * Deslizar para a esquerda → voltar (histórico), se existir.
 */
export function useSwipeMainNavHandlers() {
  const router = useRouter()
  const pathname = usePathname()
  const mobile = useIsMobileNavWidth()
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null)

  const shouldIgnoreTarget = useCallback((el: EventTarget | null) => {
    if (!(el instanceof HTMLElement)) return true
    return !!el.closest(
      '[data-no-swipe-nav],[data-slot="dialog-content"],[data-slot="sheet-content"],[role="dialog"],input,textarea,select'
    )
  }, [])

  const onTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!mobile) return
      const target = e.target
      if (shouldIgnoreTarget(target)) return
      if (target instanceof HTMLElement && target.closest('button,a')) return
      const touch = e.touches[0]
      if (!touch) return
      startRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() }
    },
    [mobile, shouldIgnoreTarget]
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!mobile || !startRef.current) return
      const touch = e.changedTouches[0]
      if (!touch) {
        startRef.current = null
        return
      }
      const endEl = document.elementFromPoint(touch.clientX, touch.clientY)
      if (shouldIgnoreTarget(endEl)) {
        startRef.current = null
        return
      }

      const { x, y, t } = startRef.current
      startRef.current = null

      if (Date.now() - t > MAX_DURATION_MS) return

      const dx = touch.clientX - x
      const dy = touch.clientY - y

      if (Math.abs(dx) < MIN_HORIZONTAL_PX) return
      if (Math.abs(dy) > Math.abs(dx) * VERTICAL_RATIO) return

      if (dx > 0) {
        if (pathname !== '/') router.push('/')
      } else if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back()
      }
    },
    [mobile, pathname, router, shouldIgnoreTarget]
  )

  return { onTouchStart, onTouchEnd }
}
