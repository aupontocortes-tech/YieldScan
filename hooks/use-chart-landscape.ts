'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ChartViewState = {
  fullscreen: boolean
  rotated: boolean
}

function notifyChartResize() {
  window.dispatchEvent(new Event('resize'))
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
}

/** Ampliar (ecrã cheio) e Rodar (paisagem simulada em retrato) — independentes. */
export function useChartLandscape() {
  const [view, setView] = useState<ChartViewState>({ fullscreen: false, rotated: false })
  const viewRef = useRef(view)
  viewRef.current = view

  const active = view.fullscreen || view.rotated

  const notify = useCallback(() => {
    notifyChartResize()
    setTimeout(notifyChartResize, 120)
    setTimeout(notifyChartResize, 400)
  }, [])

  const setPartial = useCallback(
    (patch: Partial<ChartViewState>) => {
      setView((v) => {
        const next = { ...v, ...patch }
        viewRef.current = next
        return next
      })
      notify()
    },
    [notify],
  )

  const disable = useCallback(() => {
    setView({ fullscreen: false, rotated: false })
    viewRef.current = { fullscreen: false, rotated: false }
    notifyChartResize()
  }, [])

  const toggleFullscreen = useCallback(() => {
    const v = viewRef.current
    setPartial({ fullscreen: !v.fullscreen })
  }, [setPartial])

  const toggleRotated = useCallback(() => {
    const v = viewRef.current
    setPartial({ rotated: !v.rotated })
  }, [setPartial])

  useEffect(() => {
    if (!active) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [active])

  /** Rotação física: desliga modo simulado para não duplicar. */
  useEffect(() => {
    const onOrient = () => {
      if (viewRef.current.rotated) setPartial({ rotated: false })
    }
    window.addEventListener('orientationchange', onOrient)
    return () => window.removeEventListener('orientationchange', onOrient)
  }, [setPartial])

  return {
    view,
    fullscreen: view.fullscreen,
    rotated: view.rotated,
    active,
    toggleFullscreen,
    toggleRotated,
    disable,
  }
}
