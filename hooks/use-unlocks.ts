'use client'

import { useQuery } from '@tanstack/react-query'
import type { UnlocksApiResponse, UnlocksPeriod } from '@/services/api/types/unlocks'
import type { UnlocksView } from '@/store/unlocks-store'

function viewToSort(view: UnlocksView): 'soonest' | 'unlock' {
  if (view === 'next' || view === 'wallet') return 'soonest'
  return 'unlock'
}

async function fetchUnlocks(
  period: UnlocksPeriod,
  view: UnlocksView,
  extraIds: string[]
): Promise<UnlocksApiResponse> {
  const sort = viewToSort(view)
  const params = new URLSearchParams({ period, sort })
  if (extraIds.length) params.set('ids', extraIds.join(','))
  const res = await fetch(`/api/unlocks?${params}`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error('Não foi possível carregar os desbloqueios.')
  }
  return res.json() as Promise<UnlocksApiResponse>
}

export function useUnlocks(period: UnlocksPeriod, view: UnlocksView, extraIds: string[]) {
  return useQuery({
    queryKey: ['unlocks', period, view, extraIds.join(',')],
    queryFn: () => fetchUnlocks(period, view, extraIds),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}
