'use client'

import { BtcDashboard } from '@/components/btc-dashboard/btc-dashboard'
import { BtcSettingsProvider } from '@/components/btc-dashboard/btc-settings-context'

export default function IndicatorPage() {
  return (
    <BtcSettingsProvider>
      <BtcDashboard />
    </BtcSettingsProvider>
  )
}
