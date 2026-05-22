'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const IndicatorChartRoot = dynamic(
  () =>
    import('@/components/btc-dashboard/indicator-chart-root').then((m) => ({
      default: m.IndicatorChartRoot,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 bg-[#050505] px-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#d4af37]/80" aria-hidden />
        <p className="text-sm text-zinc-500">A carregar gráfico de indicadores…</p>
      </div>
    ),
  },
)

export default function IndicatorPage() {
  return <IndicatorChartRoot />
}
