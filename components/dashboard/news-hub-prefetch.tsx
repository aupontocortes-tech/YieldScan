'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { whenYieldscanSqliteReady } from '@/lib/client-db/sqlite-core'
import { readTendenciasPrefs } from '@/lib/tendencias/prefs'
import { DEFAULT_MARKET_HIGHLIGHT_IDS } from '@/lib/mercado-highlight-ids'
import { readStoredHighlightIds } from '@/lib/mercado-highlight-ids'
import { MARKET_PINNED_STOCK_IDS } from '@/lib/us-equities'
import { fetchNoticiasClient } from '@/lib/fetch-noticias-client'
import { fetchTendenciasClient } from '@/lib/fetch-tendencias-client'
import { NEWS_CLIENT_STALE_MS } from '@/lib/news-refresh-config'

function uniqIds(ids: string[]): string {
  return [...new Set(ids.filter(Boolean))]
}

/** Pré-carrega APIs do hub Cripto e mercado para troca de abas mais rápida. */
export function NewsHubPrefetch() {
  const qc = useQueryClient()

  useEffect(() => {
    void whenYieldscanSqliteReady().then(() => {
    const tendenciasPrefs = readTendenciasPrefs()
    const highlights = readStoredHighlightIds() ?? [...DEFAULT_MARKET_HIGHLIGHT_IDS]
    const marketIds = highlights.length > 0 ? highlights : [...DEFAULT_MARKET_HIGHLIGHT_IDS]
    const allMarketIds = uniqIds([...marketIds, ...MARKET_PINNED_STOCK_IDS])
    const marketQ = `?highlights=${encodeURIComponent(allMarketIds.join(','))}`

    void qc.prefetchQuery({
      queryKey: ['dashbuddy-news'],
      queryFn: () => fetchNoticiasClient(),
      staleTime: NEWS_CLIENT_STALE_MS,
    })

    void qc.prefetchQuery({
      queryKey: ['crypto-market', allMarketIds.join('|')],
      queryFn: async () => {
        const res = await fetch(`/api/market${marketQ}`)
        if (!res.ok) throw new Error('market')
        return res.json()
      },
      staleTime: 90_000,
    })

    void qc.prefetchQuery({
      queryKey: ['tendencias', tendenciasPrefs],
      queryFn: () => fetchTendenciasClient(tendenciasPrefs),
      staleTime: 120_000,
    })
    })
  }, [qc])

  return null
}
