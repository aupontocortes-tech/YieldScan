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
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="rounded-xl border border-border/80 bg-card/45 p-5 shadow-[0_0_0_1px_rgba(232,197,71,0.06)] backdrop-blur-sm sm:p-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Explorador de Pools</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {filteredAndSortedPools.length.toLocaleString()} pools na lista (DefiLlama + Meteora DLMM). APR vem da
            DeFi Llama; no app da Uniswap o valor pode diferir (cálculo por posição e faixa de preço). TVL mínimo nos
            filtros recarrega no servidor.
          </p>
          {isFetching && !isLoading && (
            <p className="mt-2 text-xs text-gold">Atualizando lista…</p>
          )}
        </div>

        {isError && (
          <div>
            <DataLoadError onRetry={() => void refetch()} />
          </div>
        )}

        <div className="space-y-2 rounded-xl border border-border/70 bg-card/30 p-4 backdrop-blur-sm sm:p-5">
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
            {period === 'current' &&
              'APR total atual (DefiLlama). Uniswap: comparar com o link da pool — lá é estimativa da sua posição.'}
            {period === '1d' && 'Pools com dados de variacao 24h; coluna APR = taxa atual.'}
            {period === '7d' && 'APR de componente base media ~7 dias (apyBase7d), quando existir.'}
            {period === '30d' && 'APR medio dos ultimos 30 dias (apyMean30d), quando existir.'}
          </p>
        </div>

        {pools && pools.length > 0 && (
          <section className="rounded-xl border border-border/70 bg-card/25 p-1 sm:p-2">
            <PoolOpportunitiesNow pools={pools} period={period} />
          </section>
        )}

        <section className="rounded-xl border border-border/70 bg-card/25 p-3 sm:p-4">
          <PoolFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            chainOptions={chainOptions}
            pools={pools ?? []}
            period={period}
          />
        </section>

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
