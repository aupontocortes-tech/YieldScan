'use client'

import { BtcDashboard } from '@/components/btc-dashboard/btc-dashboard'
import { ChartLandscapeShell } from '@/components/btc-dashboard/chart-landscape-shell'
import { ChartDrawingsProvider } from '@/components/btc-dashboard/chart-drawings-context'
import { BtcSettingsProvider } from '@/components/btc-dashboard/btc-settings-context'

/** Árvore completa do gráfico de indicadores — só no cliente (evita SSR/WASM). */
export function IndicatorChartRoot() {
  return (
    <BtcSettingsProvider>
      <ChartDrawingsProvider>
        <ChartLandscapeShell>
          <BtcDashboard />
        </ChartLandscapeShell>
      </ChartDrawingsProvider>
    </BtcSettingsProvider>
  )
}
