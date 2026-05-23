'use client'

import { cn } from '@/lib/utils'
import {
  IMPACT_LABEL,
  impactBadgeClass,
  impactDotClass,
  type ImpactLevel,
} from '@/lib/unlocks-impact'

export function UnlocksImpactBadge({
  level,
  compact,
  className,
}: {
  level: ImpactLevel
  compact?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 font-medium',
        compact ? 'text-[10px]' : 'text-xs',
        impactBadgeClass(level),
        className
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', impactDotClass(level))} />
      {IMPACT_LABEL[level]}
    </span>
  )
}
