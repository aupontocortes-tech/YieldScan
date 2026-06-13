'use client'

import { useEffect } from 'react'
import { DEFAULT_MARKET_HIGHLIGHT_IDS } from '@/lib/mercado-highlight-ids'
import { MARKET_PINNED_STOCK_IDS } from '@/lib/us-equities'

/** Aquece /api/market (só preços) ao abrir a app para o hub carregar mais rápido. */
export function MarketApiWarm() {
  useEffect(() => {
    const ids = [...new Set([...DEFAULT_MARKET_HIGHLIGHT_IDS, ...MARKET_PINNED_STOCK_IDS])]
    const q = new URLSearchParams({
      highlights: ids.join(','),
      mode: 'highlights',
    })
    void fetch(`/api/market?${q.toString()}`).catch(() => {})
  }, [])
  return null
}
