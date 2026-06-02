'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ChartLegendSettingsFocus } from '@/components/btc-dashboard/chart-indicator-legend'
import type { ChartIndicatorHitTarget } from '@/lib/btc/chart-indicator-hit'

export type ChartIndicatorRegistryEntry = ChartIndicatorHitTarget & {
  settingsFocus: ChartLegendSettingsFocus
  onRemove: () => void
}

type ChartIndicatorsContextValue = {
  targets: ChartIndicatorRegistryEntry[]
  setTargets: (targets: ChartIndicatorRegistryEntry[]) => void
}

const ChartIndicatorsContext = createContext<ChartIndicatorsContextValue | null>(null)

export function ChartIndicatorsProvider({ children }: { children: ReactNode }) {
  const [targets, setTargetsState] = useState<ChartIndicatorRegistryEntry[]>([])

  const setTargets = useCallback((next: ChartIndicatorRegistryEntry[]) => {
    setTargetsState(next)
  }, [])

  const value = useMemo(() => ({ targets, setTargets }), [targets, setTargets])

  return <ChartIndicatorsContext.Provider value={value}>{children}</ChartIndicatorsContext.Provider>
}

export function useChartIndicators() {
  const ctx = useContext(ChartIndicatorsContext)
  if (!ctx) throw new Error('useChartIndicators must be used within ChartIndicatorsProvider')
  return ctx
}
