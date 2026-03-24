'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Header } from '@/components/header'
import { StatCard } from '@/components/stat-card'
import { TopPoolsTable } from '@/components/dashboard/top-pools-table'
import { TvlChart } from '@/components/dashboard/tvl-chart'
import { TopGainers } from '@/components/dashboard/top-gainers'
import { TokenPoolsSearch } from '@/components/dashboard/token-pools-search'
import { fetchPools, fetchAllChainsTvl, sortPools } from '@/lib/api'
import { formatCurrency, formatPercent } from '@/lib/api'
import { Activity, TrendingUp, Layers, BarChart3 } from 'lucide-react'

export default function DashboardPage() {
  const { data: pools, isLoading: poolsLoading } = useQuery({
    queryKey: ['pools'],
    queryFn: fetchPools,
  })

  const { data: chainsTvl, isLoading: tvlLoading } = useQuery({
    queryKey: ['chainsTvl'],
    queryFn: fetchAllChainsTvl,
  })

  const stats = useMemo(() => {
    if (!pools || !chainsTvl) return null

    const totalTvl = Object.values(chainsTvl).reduce((acc, tvl) => acc + tvl, 0)
    const validApys = pools.filter(p => p.apy > 0 && p.apy < 10000)
    const avgApy = validApys.length > 0
      ? validApys.reduce((acc, p) => acc + p.apy, 0) / validApys.length
      : 0
    const maxApy = Math.max(...validApys.map(p => p.apy))
    const uniqueProtocols = new Set(pools.map(p => p.project))

    return {
      totalTvl,
      avgApy,
      maxApy,
      totalPools: pools.length,
      totalProtocols: uniqueProtocols.size,
    }
  }, [pools, chainsTvl])

  const topPoolsByApy = useMemo(() => {
    if (!pools) return []
    return sortPools(
      pools.filter(p => p.apy > 0 && p.apy < 10000 && p.tvlUsd > 100000),
      'apr',
      'desc'
    ).slice(0, 5)
  }, [pools])

  const topPoolsByVolume = useMemo(() => {
    if (!pools) return []
    return sortPools(
      pools.filter(p => p.volumeUsd1d && p.volumeUsd1d > 0),
      'volume',
      'desc'
    ).slice(0, 5)
  }, [pools])

  const isLoading = poolsLoading || tvlLoading

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="TVL Total"
            value={stats ? formatCurrency(stats.totalTvl) : '-'}
            icon={Layers}
            description="Valor total bloqueado"
            isLoading={isLoading}
            valueClassName="text-foreground"
          />
          <StatCard
            title="Maior APR"
            value={stats ? formatPercent(stats.maxApy) : '-'}
            icon={TrendingUp}
            description="Pool com maior rendimento"
            isLoading={isLoading}
            valueClassName="text-success"
          />
          <StatCard
            title="APR médio"
            value={stats ? formatPercent(stats.avgApy) : '-'}
            icon={Activity}
            description="Media de todos os pools"
            isLoading={isLoading}
            valueClassName="text-cyan"
          />
          <StatCard
            title="Total de Pools"
            value={stats ? stats.totalPools.toLocaleString() : '-'}
            icon={BarChart3}
            description={`${stats?.totalProtocols ?? '-'} protocolos`}
            isLoading={isLoading}
            valueClassName="text-foreground"
          />
        </div>

        {/* Top Pools Tables */}
        <div className="mb-8 grid gap-8 lg:grid-cols-2">
          <TopPoolsTable
            pools={topPoolsByApy}
            isLoading={poolsLoading}
            title="Top 5 pools por APR"
            sortBy="apr"
          />
          <TopPoolsTable
            pools={topPoolsByVolume}
            isLoading={poolsLoading}
            title="Top 5 Pools por Volume 24h"
            sortBy="volume"
          />
        </div>

        {/* Top Gainers by Time Period */}
        <div className="mb-8">
          <TopGainers />
        </div>

        {/* Token Pools Search */}
        <div className="mb-8">
          <TokenPoolsSearch />
        </div>

        {/* TVL Chart */}
        <TvlChart />
      </main>
    </div>
  )
}
