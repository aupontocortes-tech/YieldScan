'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  dashboardPoolsLlamaQueryKey,
  dashboardPoolsMeteoraQueryKey,
  fetchDashboardLlamaPools,
  fetchDashboardMeteoraOnly,
  mergeDashboardPoolLists,
} from '@/lib/api'

/**
 * Painel: carrega DefiLlama e Meteora em paralelo, mas a UI deixa de depender dos dois
 * para o primeiro render com dados — assim que o Llama chega, mostra-se; Meteora acrescenta pools.
 */
export function useDashboardPools() {
  const llama = useQuery({
    queryKey: dashboardPoolsLlamaQueryKey,
    queryFn: fetchDashboardLlamaPools,
  })

  const meteora = useQuery({
    queryKey: dashboardPoolsMeteoraQueryKey,
    queryFn: fetchDashboardMeteoraOnly,
  })

  const pools = useMemo(
    () => (llama.data ? mergeDashboardPoolLists(llama.data, meteora.data) : undefined),
    [llama.data, meteora.data],
  )

  return {
    pools,
    isLoading: llama.isPending,
    isError: llama.isError,
    error: llama.error,
    refetch: () => {
      void llama.refetch()
      void meteora.refetch()
    },
    isMeteoraPending: meteora.isPending,
  }
}
