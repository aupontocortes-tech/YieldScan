'use client'

import dynamic from 'next/dynamic'

const DashbuddyTendencias = dynamic(
  () =>
    import('@/components/dashboard/dashbuddy-tendencias').then((m) => ({
      default: m.DashbuddyTendencias,
    })),
  {
    loading: () => (
      <div className="min-h-[200px] animate-pulse rounded-xl bg-muted/15" aria-hidden />
    ),
  }
)

export default function NewsTendenciasPage() {
  return <DashbuddyTendencias />
}
