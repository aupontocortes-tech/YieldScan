'use client'

import { useQuery } from '@tanstack/react-query'
import type { TendenciasApiResponse, TendenciasPrefs } from '@/lib/tendencias/types'

async function fetchTendencias(prefs: TendenciasPrefs): Promise<TendenciasApiResponse> {
  const q = new URLSearchParams({
    period: prefs.momentumPeriod,
    tone: prefs.analysisTone,
  })
  const res = await fetch(`/api/tendencias?${q}`)
  if (!res.ok) throw new Error('Falha ao carregar tendências')
  return res.json()
}

export function useTendencias(prefs: TendenciasPrefs) {
  return useQuery({
    queryKey: ['tendencias', prefs],
    queryFn: () => fetchTendencias(prefs),
    staleTime: 120_000,
    gcTime: 300_000,
    refetchInterval: 180_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  })
}
