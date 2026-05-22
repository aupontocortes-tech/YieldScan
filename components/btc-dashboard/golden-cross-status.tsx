'use client'

import type { GoldenCrossState } from '@/lib/btc/cycle-bottom'
import { cn } from '@/lib/utils'

export function GoldenCrossStatus({ state }: { state: GoldenCrossState }) {
  const tone =
    state.regime === 'golden'
      ? 'border-emerald-500/35 bg-emerald-950/25 text-emerald-200/95'
      : state.regime === 'death'
        ? 'border-red-500/35 bg-red-950/25 text-red-200/95'
        : 'border-zinc-700/50 bg-zinc-900/40 text-zinc-400'

  return (
    <div className={cn('rounded-lg border px-3 py-2 text-[11px] leading-relaxed', tone)}>
      {state.message}
    </div>
  )
}
