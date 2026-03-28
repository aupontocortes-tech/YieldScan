'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Header } from '@/components/header'
import { PoolFiltersComponent } from '@/components/pools/pool-filters'
import { PoolOpportunitiesNow } from '@/components/pools/pool-opportunities-now'
import { PoolTable } from '@/components/pools/pool-table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchPools, filterPools, sortPools } from '@/lib/api'
import { PoolFilters, DEFAULT_FILTERS } from '@/lib/types'
import { useNovelChains } from '@/hooks/use-novel-chains'
import { DataLoadError } from '@/components/data-load-error'
import { sortPoolsWithSmartPriority, topPoolIdsBySmartScore } from '@/lib/pool-smart-rank'

export default function PoolsPage() {
  const [filters, setFilters] = useState<PoolFilters>(DEFAULT_FILTERS)
  const [period, setPeriod] = useState<'current' | '1d' | '7d' | '30d'>('current')

  const {
    data: pools,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['pools', filters.tvlMin],
    queryFn: () => fetchPools(filters.tvlMin),
  })

  const chainOptions = useMemo(() => {
    if (!pools?.length) return []
    return [...new Set(pools.map((p) => p.chain))].sort((a, b) => a.localeCompare(b))
  }, [pools])

  const novelChains = useNovelChains(chainOptions)

  const filteredPools = useMemo(() => {
    if (!pools) return []
    return filterPools(pools, filters, period)
  }, [pools, filters, period])

  const smartFlags = useMemo(
    () => ({
      highApr: filters.smartHighApr,
      highTvl: filters.smartHighTvl,
      lowRisk: filters.smartLowRisk,
    }),
    [filters.smartHighApr, filters.smartHighTvl, filters.smartLowRisk]
  )

  const filteredAndSortedPools = useMemo(() => {
    return sortPoolsWithSmartPriority(
      filteredPools,
      period,
      smartFlags,
      filters.sortBy,
      filters.sortDirection,
      sortPools
    )
  }, [filteredPools, period, smartFlags, filters.sortBy, filters.sortDirection])

  const smartHighlightIds = useMemo(
    () => topPoolIdsBySmartScore(filteredPools, period, smartFlags, 20),
    [filteredPools, period, smartFlags]
  )

  const handleSortChange = (sortBy: PoolFilters['sortBy']) => {
    if (filters.sortBy === sortBy) {
      setFilters((f) => ({
        ...f,
        sortDirection: f.sortDirection === 'desc' ? 'asc' : 'desc',
      }))
    } else {
      setFilters((f) => ({ ...f, sortBy, sortDirection: 'desc' }))
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Explorador de Pools</h1>
          <p className="mt-1 text-muted-foreground">
            {filteredAndSortedPools.length.toLocaleString()} pools na lista (DefiLlama + Meteora DLMM). TVL mínimo
            nos filtros recarrega no servidor.
          </p>
          {isFetching && !isLoading && (
            <p className="mt-2 text-xs text-gold">Atualizando lista…</p>
          )}
        </div>

        {isError && (
          <div className="mb-6">
            <DataLoadError onRetry={() => void refetch()} />
          </div>
        )}

        <div className="mb-6 space-y-2">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <TabsList className="border border-gold/30 bg-card">
              <TabsTrigger value="current" className="data-[state=active]:bg-gold data-[state=active]:text-background">
                APR atual
              </TabsTrigger>
              <TabsTrigger value="1d" className="data-[state=active]:bg-gold data-[state=active]:text-background">
                24h
              </TabsTrigger>
              <TabsTrigger value="7d" className="data-[state=active]:bg-gold data-[state=active]:text-background">
                7 dias
              </TabsTrigger>
              <TabsTrigger value="30d" className="data-[state=active]:bg-gold data-[state=active]:text-background">
                30 dias
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground">
            {period === 'current' && 'APR total atual da pool (DefiLlama).'}
            {period === '1d' && 'Pools com dados de variacao 24h; coluna APR = taxa atual.'}
            {period === '7d' && 'APR de componente base media ~7 dias (apyBase7d), quando existir.'}
            {period === '30d' && 'APR medio dos ultimos 30 dias (apyMean30d), quando existir.'}
          </p>
        </div>

        {pools && pools.length > 0 && <PoolOpportunitiesNow pools={pools} period={period} />}

        <div className="mb-6">
          <PoolFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            chainOptions={chainOptions}
            pools={pools ?? []}
            period={period}
          />
        </div>

        <PoolTable
          pools={filteredAndSortedPools}
          isLoading={isLoading && !isError}
          filters={filters}
          period={period}
          novelChains={novelChains}
          smartHighlightIds={smartHighlightIds}
          onSortChange={handleSortChange}
        />
      </main>
    </div>
  )
}
