'use client'

import { useMemo } from 'react'
import type { Pool, PoolAprPeriod } from '@/lib/types'
import { formatCurrency, formatPercent, poolDisplayApr } from '@/lib/api'
import { pickTopOpportunityPools } from '@/lib/pool-smart-rank'
import { POOL_CARD_THEMES } from '@/lib/pools-playful-theme'
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="pools-step-dot pools-step-dot-pink" aria-hidden>
          1
        </span>
        <span className="text-xl" aria-hidden>
          ✨
        </span>
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
            Melhores oportunidades agora
          </h2>
          <p className="text-[11px] text-muted-foreground sm:text-xs">
            Top 5 — quem brilha mais em APR, volume e TVL neste momento.
          </p>
        </div>
      </div>
      <div className="pools-stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {top.map((pool, i) => {
          const apr = poolDisplayApr(pool, period)
          const theme = POOL_CARD_THEMES[i % POOL_CARD_THEMES.length]
          const isTop = i === 0
          return (
            <article
              key={pool.pool}
              className={cn(
                'pools-opportunity-card flex min-h-[8.5rem] flex-col rounded-2xl border px-3.5 py-3.5 transition-shadow duration-300',
                theme.bg,
                theme.border,
                isTop && 'ring-2 ring-pink-400/30'
              )}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', theme.rank)}>
                  #{i + 1}
                </span>
                {isTop && (
                  <span className="animate-pulse rounded-full bg-pink-500/25 px-2 py-0.5 text-[10px] font-semibold text-pink-200">
                    🏆 Top
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <PairTokenAvatars pool={pool} size={30} />
                <p className="truncate text-sm font-bold text-foreground" title={pool.symbol}>
                  {pool.symbol}
                </p>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground" title={pool.project}>
                {pool.project}
              </p>
              <p
                className={cn(
                  'mt-1.5 inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                  theme.chain
                )}
              >
                {pool.chain}
              </p>
              <div className="mt-auto space-y-1.5 pt-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    APR
                  </span>
                  <span className={cn('text-lg font-extrabold tabular-nums sm:text-xl', theme.apr)}>
                    {formatPercent(apr)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-semibold text-muted-foreground">TVL</span>
                  <span className="text-[11px] font-medium tabular-nums text-foreground/85">
                    {formatCurrency(pool.tvlUsd)}
                  </span>
                </div>
                {pool.volumeUsd1d != null && pool.volumeUsd1d > 0 && (
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] font-semibold text-muted-foreground">Vol.</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {formatCurrency(pool.volumeUsd1d)}
                    </span>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
