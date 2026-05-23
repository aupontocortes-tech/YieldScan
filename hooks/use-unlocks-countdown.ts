'use client'

import { useEffect, useState } from 'react'
import { formatCountdown } from '@/lib/unlocks-format'

/** Actualiza countdown ~1/min (ou mais frequente se < 1h). */
export function useUnlockCountdown(unlockAtMs: number | null | undefined): string | null {
  const [label, setLabel] = useState<string | null>(() => formatCountdown(unlockAtMs))

  useEffect(() => {
    setLabel(formatCountdown(unlockAtMs))
    if (unlockAtMs == null) return
    const diff = unlockAtMs - Date.now()
    const interval = diff < 3_600_000 ? 15_000 : 60_000
    const id = setInterval(() => setLabel(formatCountdown(unlockAtMs)), interval)
    return () => clearInterval(id)
  }, [unlockAtMs])

  return label
}
