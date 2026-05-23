'use client'

import { cn } from '@/lib/utils'
import type { UnlockAlert } from '@/lib/unlocks-impact'

const ALERT_TITLE: Record<NonNullable<UnlockAlert>, string> = {
  today: 'Unlock hoje',
  tomorrow: 'Unlock amanhã',
  'high-impact': 'Alto impacto',
}

export function UnlocksAlertDot({ alert }: { alert: UnlockAlert }) {
  if (!alert) return null
  const color =
    alert === 'today'
      ? 'bg-destructive animate-pulse'
      : alert === 'tomorrow'
        ? 'bg-orange-400'
        : 'bg-amber-400'
  return (
    <span
      className={cn('inline-block size-2 shrink-0 rounded-full', color)}
      title={ALERT_TITLE[alert]}
    />
  )
}
