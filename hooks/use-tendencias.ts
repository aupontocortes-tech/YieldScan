'use client'

import { useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTendenciasClient } from '@/lib/fetch-tendencias-client'
import type { TendenciasApiResponse, TendenciasPrefs } from '@/lib/tendencias/types'

export function useTendencias(prefs: TendenciasPrefs) {
  const queryClient = useQueryClient()
  const forceRefreshRef = useRef(false)

  const query = useQuery({
    queryKey: ['tendencias', prefs],
    queryFn: async () => {
      const refresh = forceRefreshRef.current
      forceRefreshRef.current = false
      return fetchTendenciasClient(prefs, { refresh })
    },
    staleTime: 120_000,
    gcTime: 300_000,
    refetchInterval: 180_000,
    refetchIntervalInBackground: true,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  })

  const refreshTendencias = useCallback(async () => {
    forceRefreshRef.current = true
    await queryClient.fetchQuery({
      queryKey: ['tendencias', prefs],
      queryFn: () => fetchTendenciasClient(prefs, { refresh: true }),
      staleTime: 0,
    })
  }, [prefs, queryClient])

  return { ...query, refreshTendencias }
}

export type { TendenciasApiResponse }
