'use client'

import { useMemo } from 'react'
import type { Pool, PoolAprPeriod } from '@/lib/types'
import { formatCurrency, formatPercent, poolDisplayApr } from '@/lib/api'
import { pickTopOpportunityPools } from '@/lib/pool-smart-rank'
import { cn } from '@/lib/utils'
import { PairTokenAvatars } from '@/components/pools/pair-token-avatars'

export function PoolOpportunitiesNow({
  pools,
  period,
}: {
  pools: Pool[]
  period: PoolAprPeriod
}) {
  const top = useMemo(() => pickTopOpportunityPools(pools, period, 5), [pools, period])

  if (top.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>
              🔥
            </span>
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Melhores oportunidades agora
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
            Recorte por APR, volume e TVL na amostra atual — indicador técnico, não é aconselhamento financeiro.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-5">
        {top.map((pool, i) => {
          const apr = poolDisplayApr(pool, period)
          return (
            <article
              key={pool.pool}
              className={cn(
                'flex min-h-[7.5rem] flex-col rounded-xl border bg-gradient-to-b from-card/90 to-background/80 px-3.5 py-3',
                i === 0
                  ? 'border-gold/50 shadow-[0_0_0_1px_rgba(232,197,71,0.12)]'
                  : 'border-border/70'
              )}
            >
              <div className="flex items-center gap-2">
                <PairTokenAvatars pool={pool} size={28} />
                <p className="truncate text-sm font-semibold text-foreground" title={pool.symbol}>
                  {pool.symbol}
                </p>
              </div>
              <p className="truncate text-[11px] text-muted-foreground" title={pool.project}>
                {pool.project}
              </p>
              <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {pool.chain}
              </p>
              <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 pt-2">
                <span className="text-base font-bold tabular-nums text-gold sm:text-lg">{formatPercent(apr)}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{formatCurrency(pool.tvlUsd)}</span>
              </div>
              {pool.volumeUsd1d != null && pool.volumeUsd1d > 0 && (
                <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                  Vol. {formatCurrency(pool.volumeUsd1d)}
                </p>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
