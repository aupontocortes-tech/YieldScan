'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  fetchAndCacheMercadoPrices,
  MERCADO_PRICES_QUERY_PREFIX,
  mercadoQueryKey,
} from '@/lib/fetch-mercado-client'
import { DEFAULT_MARKET_HIGHLIGHT_IDS, readStoredHighlightIds } from '@/lib/mercado-highlight-ids'

/** Pré-carrega preços dos favoritos no React Query ao abrir a app (útil no telemóvel/PWA). */
export function MarketApiWarm() {
  const qc = useQueryClient()

  useEffect(() => {
    const favorites = readStoredHighlightIds() ?? [...DEFAULT_MARKET_HIGHLIGHT_IDS]
    const key = mercadoQueryKey(favorites)

    void qc.prefetchQuery({
      queryKey: [MERCADO_PRICES_QUERY_PREFIX, key],
      queryFn: () => fetchAndCacheMercadoPrices(favorites),
      staleTime: 120_000,
    })
  }, [qc])

  return null
}
