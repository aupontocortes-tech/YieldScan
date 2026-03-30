'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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
    <div className="flex flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <article className="flex flex-col gap-8 rounded-2xl border border-gold/20 bg-card/35 p-4 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)] backdrop-blur-md sm:p-6 lg:p-8">
          <header className="flex flex-col gap-4 border-b border-border/50 pb-6 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Explorador de Pools</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">
                  {filteredAndSortedPools.length.toLocaleString()} pools
                </span>{' '}
                no recorte atual (DefiLlama + Meteora DLMM). APR agregado pode diferir do app de cada DEX.
              </p>
              {isFetching && !isLoading && (
                <p className="mt-2 text-xs font-medium text-gold">Atualizando lista…</p>
              )}
            </div>
            <div className="shrink-0">
              <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                <TabsList className="grid w-full grid-cols-2 border border-gold/25 bg-background/60 p-1 sm:flex sm:w-auto sm:grid-cols-none">
                  <TabsTrigger
                    value="current"
                    className="text-xs data-[state=active]:bg-gold data-[state=active]:text-background sm:text-sm"
                  >
                    APR atual
                  </TabsTrigger>
                  <TabsTrigger
                    value="1d"
                    className="text-xs data-[state=active]:bg-gold data-[state=active]:text-background sm:text-sm"
                  >
                    24h
                  </TabsTrigger>
                  <TabsTrigger
                    value="7d"
                    className="text-xs data-[state=active]:bg-gold data-[state=active]:text-background sm:text-sm"
                  >
                    7 dias
                  </TabsTrigger>
                  <TabsTrigger
                    value="30d"
                    className="text-xs data-[state=active]:bg-gold data-[state=active]:text-background sm:text-sm"
                  >
                    30 dias
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </header>

          <div className="rounded-lg border border-border/50 bg-background/35 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {period === 'current' &&
              'APR total atual (DefiLlama). Uniswap: use o link da pool — lá é estimativa da sua posição.'}
            {period === '1d' && 'Pools com dados de variação 24h; coluna APR = taxa atual.'}
            {period === '7d' && 'APR base médio ~7 dias (apyBase7d), quando existir.'}
            {period === '30d' && 'APR médio ~30 dias (apyMean30d), quando existir.'}
          </div>

          {isError && <DataLoadError onRetry={() => void refetch()} />}

          {pools && pools.length > 0 && <PoolOpportunitiesNow pools={pools} period={period} />}

          <PoolFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            chainOptions={chainOptions}
            pools={pools ?? []}
            period={period}
          />

          <PoolTable
            pools={filteredAndSortedPools}
            isLoading={isLoading && !isError}
            filters={filters}
            period={period}
            novelChains={novelChains}
            smartHighlightIds={smartHighlightIds}
            onSortChange={handleSortChange}
          />
        </article>
      </main>
    </div>
  )
}
