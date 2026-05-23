'use client'

import {
  formatUnlockDateExplicit,
  formatUnlockRelativeDate,
} from '@/lib/unlocks-format'
import { cn } from '@/lib/utils'

export function UnlocksNextDate({
  unlockAt,
  className,
}: {
  unlockAt: number | null
  className?: string
}) {
  if (unlockAt == null) {
    return <span className={cn('text-sm text-muted-foreground', className)}>Sem data</span>
  }
  return (
    <div className={cn('leading-tight', className)}>
      <p className="font-mono text-sm font-medium text-foreground">
        {formatUnlockDateExplicit(unlockAt)}
      </p>
      <p className="text-[11px] text-gold">{formatUnlockRelativeDate(unlockAt)}</p>
    </div>
  )
}
