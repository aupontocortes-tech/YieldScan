'use client'

import { BtcDashboard } from '@/components/btc-dashboard/btc-dashboard'
import { BtcSettingsProvider } from '@/components/btc-dashboard/btc-settings-context'

/** Árvore completa do gráfico de indicadores — só no cliente (evita SSR/WASM). */
export function IndicatorChartRoot() {
  return (
    <BtcSettingsProvider>
      <BtcDashboard />
    </BtcSettingsProvider>
  )
}
