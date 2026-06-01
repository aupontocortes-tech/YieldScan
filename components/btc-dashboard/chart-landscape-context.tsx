'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useChartLandscape } from '@/hooks/use-chart-landscape'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

/** Paisagem simulada só em retrato (telemóvel de pé). */
const ROTATE_PORTRAIT_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100svh',
  height: '100svw',
  maxWidth: '100svh',
  maxHeight: '100svw',
  transform: 'rotate(90deg) translateY(-100%)',
  transformOrigin: 'top left',
  zIndex: 245,
}

type ChartLandscapeContextValue = {
  fullscreen: boolean
  rotated: boolean
  rotateActive: boolean
  toggleFullscreen: () => void
  toggleRotated: () => void
  isMobile: boolean
}

const ChartLandscapeContext = createContext<ChartLandscapeContextValue | null>(null)

function useIsPortrait() {
  const [portrait, setPortrait] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight >= window.innerWidth : true,
  )
  useEffect(() => {
    const update = () => setPortrait(window.innerHeight >= window.innerWidth)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    update()
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])
  return portrait
}

export function ChartLandscapeProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()
  const isPortrait = useIsPortrait()
  const { fullscreen, rotated, toggleFullscreen, toggleRotated } = useChartLandscape()

  const rotateActive = rotated && isPortrait && isMobile

  const value: ChartLandscapeContextValue = {
    fullscreen,
    rotated,
    rotateActive,
    toggleFullscreen,
    toggleRotated,
    isMobile,
  }

  const shellClass = cn(
    'flex min-h-0 w-full flex-1 flex-col',
    (fullscreen || rotateActive) && 'overflow-hidden',
    fullscreen && !rotateActive && 'fixed inset-0 z-[245] bg-[#050505]',
    rotateActive && 'bg-[#050505]',
  )

  return (
    <ChartLandscapeContext.Provider value={value}>
      {(fullscreen || rotateActive) && isMobile && (
        <div className="fixed inset-0 z-[244] bg-[#050505]" aria-hidden />
      )}
      <div className={shellClass} style={rotateActive ? ROTATE_PORTRAIT_STYLE : undefined}>
        {children}
      </div>
    </ChartLandscapeContext.Provider>
  )
}

export function useChartLandscapeContext() {
  return useContext(ChartLandscapeContext)
}
