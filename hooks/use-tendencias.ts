'use client'

import { useQuery } from '@tanstack/react-query'
import type { TendenciasApiResponse } from '@/lib/tendencias/types'

async function fetchTendencias(): Promise<TendenciasApiResponse> {
  const res = await fetch('/api/tendencias')
  if (!res.ok) throw new Error('Falha ao carregar tendências')
  return res.json()
}

export function useTendencias() {
  return useQuery({
    queryKey: ['tendencias'],
    queryFn: fetchTendencias,
    staleTime: 90_000,
    refetchInterval: 120_000,
  })
}
