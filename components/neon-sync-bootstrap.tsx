'use client'

import { useEffect } from 'react'
import { initExtraNeonSync } from '@/lib/neon/sync-extra'
import { initGfNeonSync } from '@/lib/neon/sync-gestao'
import { initIndicatorsNeonSync } from '@/lib/neon/sync-indicators'
import { initPortfolioNeonSync } from '@/lib/neon/sync-portfolio'

/** Inicia sync Neon em background (dados do app + preferências). */
export function NeonSyncBootstrap() {
  useEffect(() => {
    const cleanups = [
      initGfNeonSync(),
      initPortfolioNeonSync(),
      initIndicatorsNeonSync(),
      initExtraNeonSync(),
    ]
    return () => {
      for (const fn of cleanups) fn()
    }
  }, [])

  return null
}
