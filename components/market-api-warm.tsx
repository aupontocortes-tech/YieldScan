'use client'

import { useEffect } from 'react'
import { DEFAULT_MARKET_HIGHLIGHT_IDS } from '@/lib/mercado-highlight-ids'
import { MARKET_PINNED_STOCK_IDS } from '@/lib/us-equities'

/** Aquece /api/market ao abrir a app (qualquer rota) para preços mais rápidos no hub. */
export function MarketApiWarm() {
  useEffect(() => {
    const ids = [...new Set([...DEFAULT_MARKET_HIGHLIGHT_IDS, ...MARKET_PINNED_STOCK_IDS])]
    const q = `?highlights=${encodeURIComponent(ids.join(','))}`
    void fetch(`/api/market${q}`).catch(() => {})
  }, [])
  return null
}
