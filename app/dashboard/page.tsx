'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { StatCard } from '@/components/stat-card'
import { TopPoolsTable } from '@/components/dashboard/top-pools-table'
import { TokenPoolsSearch } from '@/components/dashboard/token-pools-search'
import { DashboardHub } from '@/components/dashboard/dashboard-hub'
import {
  DASHBOARD_POOLS_MIN_TVL,
  fetchAllChainsTvl,
  sortPools,
} from '@/lib/api'
import { useDashboardPools } from '@/hooks/use-dashboard-pools'
import { formatCurrency, formatPercent } from '@/lib/api'
import { Activity, TrendingUp, Layers, BarChart3 } from 'lucide-react'
import { DataLoadError } from '@/components/data-load-error'

const TopGainers = dynamic(
  () => import('@/components/dashboard/top-gainers').then((m) => m.TopGainers),
  { loading: () => <div className="mb-8 h-44 animate-pulse rounded-xl bg-muted/15" aria-hidden /> }
)

const TvlChart = dynamic(
  () => import('@/components/dashboard/tvl-chart').then((m) => m.TvlChart),
  { loading: () => <div className="mb-8 h-72 animate-pulse rounded-xl bg-muted/15" aria-hidden /> }
)

export default function DashboardPage() {
  const {
    pools,
    isLoading: poolsLoading,
    isError: poolsError,
    refetch: refetchPools,
  } = useDashboardPools()

  const {
    data: chainsTvl,
    isLoading: tvlLoading,
    isError: tvlError,
    refetch: refetchTvl,
  } = useQuery({
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
    const maxApy = validApys.length > 0 ? Math.max(...validApys.map((p) => p.apy)) : 0
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

  const hasLoadError = poolsError || tvlError

  return (
    <div className="flex flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {hasLoadError && (
          <div className="mb-6">
            <DataLoadError
              message={
                poolsError
                  ? 'Não foi possível carregar os pools (DefiLlama / Meteora). Toque para tentar de novo.'
                  : 'Não foi possível carregar o TVL por rede.'
              }
              onRetry={() => {
                void refetchPools()
                void refetchTvl()
              }}
            />
          </div>
        )}

        <DashboardHub />

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="TVL Total"
            value={stats ? formatCurrency(stats.totalTvl) : '-'}
            icon={Layers}
            description="Valor total bloqueado"
            isLoading={tvlLoading && !tvlError}
            valueClassName="text-foreground"
          />
          <StatCard
            title="Maior APR"
            value={stats ? formatPercent(stats.maxApy) : '-'}
            icon={TrendingUp}
            description="Pool com maior APR (amostra)"
            isLoading={poolsLoading && !poolsError}
            valueClassName="text-success"
          />
          <StatCard
            title="APR médio"
            value={stats ? formatPercent(stats.avgApy) : '-'}
            icon={Activity}
            description="Média na amostra carregada"
            isLoading={poolsLoading && !poolsError}
            valueClassName="text-cyan"
          />
          <StatCard
            title="Total de Pools"
            value={stats ? stats.totalPools.toLocaleString() : '-'}
            icon={BarChart3}
            description={`${stats?.totalProtocols ?? '-'} protocolos · TVL mín. amostra ${(DASHBOARD_POOLS_MIN_TVL / 1000).toFixed(0)}k`}
            isLoading={poolsLoading && !poolsError}
            valueClassName="text-foreground"
          />
        </div>

        <div className="mb-8 grid gap-8 lg:grid-cols-2">
          <TopPoolsTable
            pools={topPoolsByApy}
            isLoading={poolsLoading && !poolsError}
            title="Top 5 pools por APR"
            sortBy="apr"
          />
          <TopPoolsTable
            pools={topPoolsByVolume}
            isLoading={poolsLoading && !poolsError}
            title="Top 5 Pools por Volume 24h"
            sortBy="volume"
          />
        </div>

        <div className="mb-8">
          <TopGainers />
        </div>

        <div className="mb-8">
          <TokenPoolsSearch />
        </div>

        <TvlChart />
      </main>
    </div>
  )
}
