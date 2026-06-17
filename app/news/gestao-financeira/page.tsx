'use client'

import dynamic from 'next/dynamic'

const GestaoFinanceiraPage = dynamic(
  () =>
    import('@/components/gestao-financeira/gestao-financeira-page').then((m) => ({
      default: m.GestaoFinanceiraPage,
    })),
  {
    loading: () => (
      <div className="space-y-4 p-1">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-muted/20" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/15" />
          ))}
        </div>
      </div>
    ),
  },
)

export default function GestaoFinanceiraRoutePage() {
  return <GestaoFinanceiraPage />
}
