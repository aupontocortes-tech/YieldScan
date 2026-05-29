'use client'

import { useQuery } from '@tanstack/react-query'
import type { TendenciasApiResponse, TendenciasPrefs } from '@/lib/tendencias/types'

async function fetchTendencias(prefs: TendenciasPrefs): Promise<TendenciasApiResponse> {
  const q = new URLSearchParams({
    period: prefs.momentumPeriod,
    tone: prefs.analysisTone,
    llm: prefs.useLlm ? '1' : '0',
  })
  if (prefs.customPromptNote.trim()) {
    q.set('note', prefs.customPromptNote.trim())
  }
  const res = await fetch(`/api/tendencias?${q}`)
  if (!res.ok) throw new Error('Falha ao carregar tendências')
  return res.json()
}

export function useTendencias(prefs: TendenciasPrefs) {
  return useQuery({
    queryKey: ['tendencias', prefs],
    queryFn: () => fetchTendencias(prefs),
    staleTime: 90_000,
    refetchInterval: 120_000,
  })
}
