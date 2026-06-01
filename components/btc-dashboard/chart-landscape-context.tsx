'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useChartLandscape, type ChartLandscapeMode } from '@/hooks/use-chart-landscape'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

type ChartLandscapeContextValue = {
  active: boolean
  mode: ChartLandscapeMode
  toggle: () => void
  disable: () => void
  isMobile: boolean
}

const ChartLandscapeContext = createContext<ChartLandscapeContextValue | null>(null)

export function ChartLandscapeProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()
  const { active, mode, toggle, disable } = useChartLandscape()

  const value: ChartLandscapeContextValue = { active, mode, toggle, disable, isMobile }

  return (
    <ChartLandscapeContext.Provider value={value}>
      <div
        className={cn(
          'flex min-h-0 w-full flex-1 flex-col',
          active &&
            'fixed inset-0 z-[245] flex flex-col overflow-hidden bg-[#050505]',
        )}
      >
        {children}
      </div>
    </ChartLandscapeContext.Provider>
  )
}

export function useChartLandscapeContext() {
  return useContext(ChartLandscapeContext)
}
