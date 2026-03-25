'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Header } from '@/components/header'
import { PoolFiltersComponent } from '@/components/pools/pool-filters'
import { PoolTable } from '@/components/pools/pool-table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchPools, filterPools, sortPools } from '@/lib/api'
import { PoolFilters, DEFAULT_FILTERS } from '@/lib/types'
import { useNovelChains } from '@/hooks/use-novel-chains'

export default function PoolsPage() {
  const [filters, setFilters] = useState<PoolFilters>(DEFAULT_FILTERS)
  const [period, setPeriod] = useState<'current' | '1d' | '7d' | '30d'>('current')

  const { data: pools, isLoading } = useQuery({
    queryKey: ['pools', filters.tvlMin],
    queryFn: () => fetchPools(filters.tvlMin),
  })

  const chainOptions = useMemo(() => {
    if (!pools?.length) return []
    return [...new Set(pools.map((p) => p.chain))].sort((a, b) => a.localeCompare(b))
  }, [pools])

  const novelChains = useNovelChains(chainOptions)

  const protocolOptions = useMemo(() => {
    if (!pools?.length) return []
    return [...new Set(pools.map((p) => p.project))].sort((a, b) => a.localeCompare(b))
  }, [pools])

  const filteredAndSortedPools = useMemo(() => {
    if (!pools) return []

    const result = filterPools(pools, filters, period)

    return sortPools(result, filters.sortBy, filters.sortDirection, period)
  }, [pools, filters, period])

  const handleSortChange = (sortBy: PoolFilters['sortBy']) => {
    if (filters.sortBy === sortBy) {
      setFilters(f => ({
        ...f,
        sortDirection: f.sortDirection === 'desc' ? 'asc' : 'desc',
      }))
    } else {
      setFilters(f => ({ ...f, sortBy, sortDirection: 'desc' }))
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            Explorador de Pools
          </h1>
          <p className="mt-1 text-muted-foreground">
            {filteredAndSortedPools.length.toLocaleString()} pools na lista (dados via servidor: DefiLlama +
            Meteora DLMM). Ajuste o TVL mínimo nos filtros para recarregar mais opções — no celular o total
            é limitado para o app abrir rápido.
          </p>
        </div>

        {/* Period Tabs */}
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
            {period === '1d' &&
              'Pools com dados de variacao 24h; coluna APR = taxa atual.'}
            {period === '7d' && 'APR de componente base media ~7 dias (apyBase7d), quando existir.'}
            {period === '30d' && 'APR medio dos ultimos 30 dias (apyMean30d), quando existir.'}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <PoolFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            chainOptions={chainOptions}
            protocolOptions={protocolOptions}
          />
        </div>

        {/* Table */}
        <PoolTable
          pools={filteredAndSortedPools}
          isLoading={isLoading}
          filters={filters}
          period={period}
          novelChains={novelChains}
          onSortChange={handleSortChange}
        />
      </main>
    </div>
  )
}
