'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Header } from '@/components/header'
import { PoolFiltersComponent } from '@/components/pools/pool-filters'
import { PoolTable } from '@/components/pools/pool-table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchPools, filterPools, sortPools } from '@/lib/api'
import { PoolFilters, DEFAULT_FILTERS } from '@/lib/types'

export default function PoolsPage() {
  const [filters, setFilters] = useState<PoolFilters>(DEFAULT_FILTERS)
  const [period, setPeriod] = useState<'current' | '1d' | '7d' | '30d'>('current')

  const { data: pools, isLoading } = useQuery({
    queryKey: ['pools'],
    queryFn: fetchPools,
  })

  const filteredAndSortedPools = useMemo(() => {
    if (!pools) return []

    // Apply filters
    let result = filterPools(pools, {
      search: filters.search,
      chains: filters.chains,
      protocols: filters.protocols,
      aprMin: filters.aprMin,
      aprMax: filters.aprMax,
      tvlMin: filters.tvlMin,
      ilRisk: filters.ilRisk,
      exposure: filters.exposure,
      stablecoinOnly: filters.stablecoinOnly,
    })

    // Apply period filter to APR display (dados: campos apy* na API)
    if (period !== 'current') {
      result = result.filter(pool => {
        if (period === '1d') return pool.apyBase1d !== null
        if (period === '7d') return pool.apyPct7D !== null
        if (period === '30d') return pool.apyMean30d !== null
        return true
      })
    }

    // Sort
    return sortPools(result, filters.sortBy, filters.sortDirection)
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
          <h1 className="text-2xl font-bold text-foreground">Explorador de Pools</h1>
          <p className="mt-1 text-muted-foreground">
            Compare APR de {filteredAndSortedPools.length.toLocaleString()} pools em multiplas chains
          </p>
        </div>

        {/* Period Tabs */}
        <div className="mb-6">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="current">APR Base</TabsTrigger>
              <TabsTrigger value="1d">24h</TabsTrigger>
              <TabsTrigger value="7d">7 Dias</TabsTrigger>
              <TabsTrigger value="30d">30 Dias</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <PoolFiltersComponent filters={filters} onFiltersChange={setFilters} />
        </div>

        {/* Table */}
        <PoolTable
          pools={filteredAndSortedPools}
          isLoading={isLoading}
          filters={filters}
          onSortChange={handleSortChange}
        />
      </main>
    </div>
  )
}
