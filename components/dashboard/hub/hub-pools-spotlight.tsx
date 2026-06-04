'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { BarChart3, Target } from 'lucide-react'
import { useDashboardPools } from '@/hooks/use-dashboard-pools'
import { formatCurrency, sortPools } from '@/lib/api'
import type { Pool } from '@/lib/types'
import { HubPanel } from '@/components/dashboard/hub/hub-panel'
import { PairTokenAvatars } from '@/components/pools/pair-token-avatars'
import { ChainBadge } from '@/components/chain-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SPOTLIGHT_LIMIT = 5
const MIN_TVL = 25_000

function sanePools(pools: Pool[]): Pool[] {
  return pools.filter(
    (p) =>
      (p.tvlUsd ?? 0) >= MIN_TVL &&
      (p.apy == null || p.apy < 10_000) &&
      p.symbol?.trim(),
  )
}

function PoolRankRow({
  pool,
  rank,
  metric,
  metricLabel,
}: {
  pool: Pool
  rank: number
  metric: string
  metricLabel: string
}) {
  return (
    <li>
      <Link
        href="/pools"
        className={cn(
          'flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors',
          rank === 1
            ? 'border-cyan-500/30 bg-cyan-500/8 hover:bg-cyan-500/12'
            : 'border-border/40 bg-background/25 hover:border-border/60 hover:bg-muted/15',
        )}
      >
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tabular-nums',
            rank === 1 ? 'bg-cyan-500/20 text-cyan-300' : 'bg-muted/40 text-muted-foreground',
          )}
        >
          {rank}
        </span>
        <PairTokenAvatars pool={pool} size={26} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">{pool.symbol}</p>
          <p className="truncate text-[10px] text-muted-foreground">{pool.project}</p>
        </div>
        <div className="hidden shrink-0 sm:block">
          <ChainBadge chain={pool.chain} className="scale-90 origin-right" />
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-xs font-semibold tabular-nums text-foreground">{metric}</p>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{metricLabel}</p>
        </div>
      </Link>
    </li>
  )
}

function PoolColumn({
  title,
  subtitle,
  pools,
  metricLabel,
  formatMetric,
}: {
  title: string
  subtitle: string
  pools: Pool[]
  metricLabel: string
  formatMetric: (p: Pool) => string
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border/45 bg-background/20">
      <div className="border-b border-border/40 px-3 py-2.5">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
      </div>
      <ul className="space-y-1.5 p-2">
        {pools.map((pool, i) => (
          <PoolRankRow
            key={pool.pool}
            pool={pool}
            rank={i + 1}
            metric={formatMetric(pool)}
            metricLabel={metricLabel}
          />
        ))}
      </ul>
    </div>
  )
}

export function HubPoolsSpotlight() {
  const { pools, isLoading, isError, refetch } = useDashboardPools()

  const { byTvl, byVolume } = useMemo(() => {
    if (!pools?.length) return { byTvl: [] as Pool[], byVolume: [] as Pool[] }
    const base = sanePools(pools)
    const byTvl = sortPools(base, 'tvl', 'desc').slice(0, SPOTLIGHT_LIMIT)
    const byVolume = sortPools(
      base.filter((p) => (p.volumeUsd1d ?? 0) > 0),
      'volume',
      'desc',
    ).slice(0, SPOTLIGHT_LIMIT)
    return { byTvl, byVolume }
  }, [pools])

  return (
    <HubPanel
      title="Caça-pools"
      subtitle="Onde a liquidez e o volume estão mais fortes agora"
      icon={Target}
      iconClassName="text-cyan-400"
      href="/pools"
      linkLabel="Explorar pools"
      bodyClassName="!py-4"
    >
      {isLoading && (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-dashed border-border/60 py-8 text-center">
          <p className="text-xs text-muted-foreground">Não foi possível carregar pools.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-500/15 bg-cyan-950/20 px-3 py-2">
            <BarChart3 className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
            <p className="text-[11px] text-muted-foreground">
              Top {SPOTLIGHT_LIMIT} na amostra YieldScan (TVL mín. {(MIN_TVL / 1000).toFixed(0)}k). Filtra e
              compara no explorador completo.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {byTvl.length > 0 ? (
              <PoolColumn
                title="Maior TVL"
                subtitle="Pools com mais capital bloqueado"
                pools={byTvl}
                metricLabel="TVL"
                formatMetric={(p) => formatCurrency(p.tvlUsd ?? 0)}
              />
            ) : (
              <p className="rounded-xl border border-dashed border-border/50 py-6 text-center text-xs text-muted-foreground md:col-span-1">
                Sem dados de TVL.
              </p>
            )}
            {byVolume.length > 0 ? (
              <PoolColumn
                title="Maior volume 24h"
                subtitle="Pools com mais negociação"
                pools={byVolume}
                metricLabel="Vol. 24h"
                formatMetric={(p) => formatCurrency(p.volumeUsd1d ?? 0)}
              />
            ) : (
              <p className="rounded-xl border border-dashed border-border/50 py-6 text-center text-xs text-muted-foreground md:col-span-1">
                Sem volume 24h na amostra.
              </p>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link
              href="/pools"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/15 py-2.5 text-center text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/25 sm:flex-none sm:px-6"
            >
              <Target className="h-3.5 w-3.5" />
              Caçar pools
            </Link>
            <Link
              href="/pools/blue-chips"
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-border/50 py-2.5 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground sm:flex-none sm:px-5"
            >
              Blue chips
            </Link>
          </div>
        </>
      )}
    </HubPanel>
  )
}
