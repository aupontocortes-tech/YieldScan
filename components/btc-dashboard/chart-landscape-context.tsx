'use client'

import {
  createContext,
  useContext,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useChartLandscape, type ChartLandscapeMode } from '@/hooks/use-chart-landscape'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

const LANDSCAPE_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100dvh',
  height: '100dvw',
  maxWidth: '100dvh',
  maxHeight: '100dvw',
  transform: 'rotate(90deg) translateY(-100%)',
  transformOrigin: 'top left',
  zIndex: 245,
}

type ChartLandscapeContextValue = {
  active: boolean
  mode: ChartLandscapeMode
  toggle: () => void
  isMobile: boolean
}

const ChartLandscapeContext = createContext<ChartLandscapeContextValue | null>(null)

export function ChartLandscapeProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()
  const { active, mode, toggle } = useChartLandscape()

  const value: ChartLandscapeContextValue = { active, mode, toggle, isMobile }

  if (!isMobile) {
    return (
      <ChartLandscapeContext.Provider value={value}>
        {children}
      </ChartLandscapeContext.Provider>
    )
  }

  return (
    <ChartLandscapeContext.Provider value={value}>
      {active && mode === 'css' && (
        <div className="fixed inset-0 z-[244] bg-[#050505]" aria-hidden />
      )}
      <div
        className={cn(
          'flex min-h-0 w-full flex-1 flex-col',
          active && mode === 'css' && 'overflow-hidden',
        )}
        style={active && mode === 'css' ? LANDSCAPE_STYLE : undefined}
      >
        {children}
      </div>
    </ChartLandscapeContext.Provider>
  )
}

export function useChartLandscapeContext() {
  return useContext(ChartLandscapeContext)
}
