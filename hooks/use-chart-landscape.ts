'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ChartLandscapeMode = 'off' | 'native' | 'css'

function notifyChartResize() {
  window.dispatchEvent(new Event('resize'))
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
}

async function tryNativeLandscape(): Promise<boolean> {
  if (typeof screen === 'undefined' || !('orientation' in screen)) return false
  const orient = screen.orientation as ScreenOrientation & {
    lock?: (type: OrientationLockType) => Promise<void>
  }
  if (!orient?.lock) return false

  try {
    const root = document.documentElement
    if (!document.fullscreenElement && root.requestFullscreen) {
      await root.requestFullscreen()
    }
    await orient.lock('landscape')
    return true
  } catch {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
    } catch {
      /* ignore */
    }
    return false
  }
}

async function exitNativeLandscape() {
  try {
    screen.orientation?.unlock?.()
  } catch {
    /* ignore */
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
  } catch {
    /* ignore */
  }
}

export function useChartLandscape() {
  const [mode, setMode] = useState<ChartLandscapeMode>('off')
  const modeRef = useRef(mode)
  modeRef.current = mode

  const active = mode !== 'off'

  const disable = useCallback(async () => {
    if (modeRef.current === 'native') await exitNativeLandscape()
    setMode('off')
    notifyChartResize()
  }, [])

  const enable = useCallback(async () => {
    const native = await tryNativeLandscape()
    setMode(native ? 'native' : 'css')
    notifyChartResize()
    setTimeout(notifyChartResize, 120)
    setTimeout(notifyChartResize, 400)
  }, [])

  const toggle = useCallback(() => {
    if (modeRef.current !== 'off') void disable()
    else void enable()
  }, [disable, enable])

  useEffect(() => {
    if (!active) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [active])

  useEffect(() => {
    if (mode !== 'native') return
    const onChange = () => {
      const type = screen.orientation?.type ?? ''
      if (type.startsWith('portrait') && modeRef.current === 'native') {
        void disable()
      }
    }
    screen.orientation?.addEventListener?.('change', onChange)
    return () => screen.orientation?.removeEventListener?.('change', onChange)
  }, [mode, disable])

  useEffect(() => {
    return () => {
      if (modeRef.current === 'native') void exitNativeLandscape()
    }
  }, [])

  return { active, mode, toggle, disable, enable }
}
