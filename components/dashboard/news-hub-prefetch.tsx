'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { whenYieldscanSqliteReady } from '@/lib/client-db/sqlite-core'
import {
  fetchAndCacheMercadoPrices,
  MERCADO_PRICES_QUERY_PREFIX,
  mercadoQueryKey,
} from '@/lib/fetch-mercado-client'
import { readTendenciasPrefs } from '@/lib/tendencias/prefs'
import { DEFAULT_MARKET_HIGHLIGHT_IDS, readStoredHighlightIds } from '@/lib/mercado-highlight-ids'
import { fetchNoticiasClient } from '@/lib/fetch-noticias-client'
import { fetchTendenciasClient } from '@/lib/fetch-tendencias-client'
import { NEWS_CLIENT_STALE_MS } from '@/lib/news-refresh-config'

/** Pré-carrega APIs do hub Cripto e mercado para troca de abas mais rápida. */
export function NewsHubPrefetch() {
  const qc = useQueryClient()

  useEffect(() => {
    const highlights = readStoredHighlightIds() ?? [...DEFAULT_MARKET_HIGHLIGHT_IDS]
    const favoriteQueryKey = mercadoQueryKey(highlights)

    void qc.prefetchQuery({
      queryKey: ['dashbuddy-news'],
      queryFn: () => fetchNoticiasClient(),
      staleTime: NEWS_CLIENT_STALE_MS,
    })

    void qc.prefetchQuery({
      queryKey: [MERCADO_PRICES_QUERY_PREFIX, favoriteQueryKey],
      queryFn: () => fetchAndCacheMercadoPrices(highlights),
      staleTime: 120_000,
    })

    void whenYieldscanSqliteReady().then(() => {
      const tendenciasPrefs = readTendenciasPrefs()
      void qc.prefetchQuery({
        queryKey: ['tendencias', tendenciasPrefs],
        queryFn: () => fetchTendenciasClient(tendenciasPrefs),
        staleTime: 120_000,
      })
    })
  }, [qc])

  return null
}
