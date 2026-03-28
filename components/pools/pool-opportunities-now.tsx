'use client'

import { useMemo } from 'react'
import type { Pool, PoolAprPeriod } from '@/lib/types'
import { formatCurrency, formatPercent, poolDisplayApr } from '@/lib/api'
import { pickTopOpportunityPools } from '@/lib/pool-smart-rank'

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
    <section className="mb-6 rounded-xl border border-gold/30 bg-card/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          🔥
        </span>
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          Melhores oportunidades agora
        </h2>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        Combinação de APR, volume 24h e TVL na amostra atual. Indicador técnico — não é aconselhamento
        financeiro.
      </p>
      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        {top.map((pool) => {
          const apr = poolDisplayApr(pool, period)
          return (
            <article
              key={pool.pool}
              className="snap-start rounded-lg border border-gold/20 bg-background/90 px-3 py-2.5 shadow-sm min-w-[min(100%,11rem)] max-w-[13rem] shrink-0"
            >
              <p className="truncate text-xs font-semibold text-foreground" title={pool.symbol}>
                {pool.symbol}
              </p>
              <p className="truncate text-[10px] text-muted-foreground" title={pool.project}>
                {pool.project}
              </p>
              <p className="mt-1.5 text-[10px] text-muted-foreground">{pool.chain}</p>
              <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] tabular-nums">
                <span className="text-gold">{formatPercent(apr)}</span>
                <span className="text-muted-foreground">{formatCurrency(pool.tvlUsd)}</span>
              </div>
              {pool.volumeUsd1d != null && pool.volumeUsd1d > 0 && (
                <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                  Vol. {formatCurrency(pool.volumeUsd1d)}
                </p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
