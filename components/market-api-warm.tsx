'use client'

import { useEffect } from 'react'
import { DEFAULT_MARKET_HIGHLIGHT_IDS } from '@/lib/mercado-highlight-ids'
import { MARKET_PINNED_STOCK_IDS } from '@/lib/us-equities'

const WARM_KEY = 'yieldscan:market-warm-at'
const WARM_MIN_MS = 5 * 60_000

/** Aquece /api/market (só preços) no máximo 1× a cada 5 min por sessão. */
export function MarketApiWarm() {
  useEffect(() => {
    try {
      const last = Number(sessionStorage.getItem(WARM_KEY) || 0)
      if (Date.now() - last < WARM_MIN_MS) return
      sessionStorage.setItem(WARM_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }

    const ids = [...new Set([...DEFAULT_MARKET_HIGHLIGHT_IDS, ...MARKET_PINNED_STOCK_IDS])]
    const q = new URLSearchParams({
      highlights: ids.join(','),
      mode: 'highlights',
    })
    void fetch(`/api/market?${q.toString()}`).catch(() => {})
  }, [])
  return null
}
