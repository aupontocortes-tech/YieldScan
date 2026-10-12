'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const TrainDashboard = dynamic(
  () => import('@/components/hyperliquid/train-dashboard').then((m) => ({ default: m.TrainDashboard })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center gap-3 bg-[#050507]">
        <Loader2 className="h-7 w-7 animate-spin text-lime-400" />
        <p className="text-sm text-zinc-500">A carregar treino simulado…</p>
      </div>
    ),
  },
)

export default function TreinarPage() {
  return <TrainDashboard />
}
