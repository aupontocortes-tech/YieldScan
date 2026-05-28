'use client'

import type { ReactNode } from 'react'
import { ChartLandscapeProvider } from '@/components/btc-dashboard/chart-landscape-context'

/** Envolve Indicadores com rotação paisagem no telemóvel. */
export function ChartLandscapeShell({ children }: { children: ReactNode }) {
  return <ChartLandscapeProvider>{children}</ChartLandscapeProvider>
}
