'use client'

import { formatDualSupplyPct } from '@/lib/unlocks-format'
import { cn } from '@/lib/utils'

export function UnlocksDualPct({
  circPct,
  maxPct,
  className,
}: {
  circPct: number | null | undefined
  maxPct: number | null | undefined
  className?: string
}) {
  return (
    <span className={cn('font-mono text-xs leading-tight text-muted-foreground', className)}>
      {formatDualSupplyPct(circPct, maxPct)}
    </span>
  )
}
