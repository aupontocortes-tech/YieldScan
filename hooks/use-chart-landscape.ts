'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ChartLandscapeMode = 'off' | 'fullscreen'

function notifyChartResize() {
  window.dispatchEvent(new Event('resize'))
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
}

/** Ecrã cheio do gráfico (sem rotação CSS — evita layout torto no preview/desktop). */
export function useChartLandscape() {
  const [mode, setMode] = useState<ChartLandscapeMode>('off')
  const modeRef = useRef(mode)
  modeRef.current = mode

  const active = mode === 'fullscreen'

  const disable = useCallback(() => {
    setMode('off')
    notifyChartResize()
  }, [])

  const enable = useCallback(() => {
    setMode('fullscreen')
    notifyChartResize()
    setTimeout(notifyChartResize, 120)
    setTimeout(notifyChartResize, 400)
  }, [])

  const toggle = useCallback(() => {
    if (modeRef.current !== 'off') disable()
    else enable()
  }, [disable, enable])

  useEffect(() => {
    if (!active) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [active])

  return { active, mode, toggle, disable, enable }
}
