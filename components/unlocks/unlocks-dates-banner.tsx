'use client'

import { useMemo } from 'react'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import type { UnlockTokenProfile } from '@/services/api/types/unlocks'
import { formatCurrency, formatUnlockDateExplicit, formatUnlockRelativeDate } from '@/lib/unlocks-format'
import { cn } from '@/lib/utils'

export function UnlocksDatesBanner({
  rows,
  selectedGeckoId,
  onSelect,
  className,
}: {
  rows: UnlockTokenProfile[]
  selectedGeckoId: string | null
  onSelect: (id: string) => void
  className?: string
}) {
  const upcoming = useMemo(
    () =>
      [...rows]
        .filter((r) => r.nextUnlockAt != null)
        .sort((a, b) => a.nextUnlockAt! - b.nextUnlockAt!)
        .slice(0, 6),
    [rows]
  )

  if (!upcoming.length) return null

  const next = upcoming[0]!

  return (
    <section
      className={cn(
        'rounded-xl border border-gold/25 bg-gradient-to-r from-gold/[0.08] via-card to-card p-4',
        className
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <button
          type="button"
          onClick={() => onSelect(next.geckoId)}
          className="group min-w-0 flex-1 text-left"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Próximo desbloqueio
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <TokenSymbolAvatar
              symbol={next.symbol}
              coingeckoId={next.geckoId}
              iconUrl={next.image}
              size={36}
              className="ring-2 ring-gold/30"
            />
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {formatUnlockDateExplicit(next.nextUnlockAt)}
              </p>
              <p className="mt-0.5 text-sm text-gold">
                {next.symbol} · {formatUnlockRelativeDate(next.nextUnlockAt)}
                {next.nextUnlockUsd != null && (
                  <span className="text-muted-foreground">
                    {' '}
                    · {formatCurrency(next.nextUnlockUsd, true)}
                  </span>
                )}
              </p>
            </div>
          </div>
        </button>

        <div className="w-full lg:max-w-md">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Calendário
          </p>
          <ul className="mt-2 divide-y divide-border/40 rounded-lg border border-border/40 bg-background/40">
            {upcoming.map((row) => (
              <li key={row.geckoId}>
                <button
                  type="button"
                  onClick={() => onSelect(row.geckoId)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/30',
                    row.geckoId === selectedGeckoId && 'bg-gold/10'
                  )}
                >
                  <TokenSymbolAvatar
                    symbol={row.symbol}
                    coingeckoId={row.geckoId}
                    iconUrl={row.image}
                    size={22}
                  />
                  <span className="w-14 shrink-0 font-mono font-semibold">{row.symbol}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">
                    {formatUnlockDateExplicit(row.nextUnlockAt)}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-gold">
                    {formatCurrency(row.nextUnlockUsd ?? 0, true)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
