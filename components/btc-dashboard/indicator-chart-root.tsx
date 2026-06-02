'use client'

import { BtcDashboard } from '@/components/btc-dashboard/btc-dashboard'
import { ChartLandscapeShell } from '@/components/btc-dashboard/chart-landscape-shell'
import { ChartDrawingsProvider } from '@/components/btc-dashboard/chart-drawings-context'
import { ChartIndicatorsProvider } from '@/components/btc-dashboard/chart-indicators-context'
import { BtcSettingsProvider } from '@/components/btc-dashboard/btc-settings-context'

/** Árvore completa do gráfico de indicadores — só no cliente (evita SSR/WASM). */
export function IndicatorChartRoot() {
  return (
    <BtcSettingsProvider>
      <ChartDrawingsProvider>
        <ChartIndicatorsProvider>
          <ChartLandscapeShell>
            <BtcDashboard />
          </ChartLandscapeShell>
        </ChartIndicatorsProvider>
      </ChartDrawingsProvider>
    </BtcSettingsProvider>
  )
}
