'use client'

import { useEffect } from 'react'
import { initGfNeonSync } from '@/lib/neon/sync-gestao'
import { initIndicatorsNeonSync } from '@/lib/neon/sync-indicators'
import { initPortfolioNeonSync } from '@/lib/neon/sync-portfolio'

/** Inicia sync Neon em background (Gestão, Carteira, Indicadores). */
export function NeonSyncBootstrap() {
  useEffect(() => {
    const cleanups = [initGfNeonSync(), initPortfolioNeonSync(), initIndicatorsNeonSync()]
    return () => {
      for (const fn of cleanups) fn()
    }
  }, [])

  return null
}
