'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import { UnlocksImpactBadge } from '@/components/unlocks/unlocks-impact-badge'
import { UnlocksDualPct } from '@/components/unlocks/unlocks-dual-pct'
import { UnlocksAlertDot } from '@/components/unlocks/unlocks-alert-dot'
import { useUnlockCountdown } from '@/hooks/use-unlocks-countdown'
import type { UnlockTokenProfile } from '@/services/api/types/unlocks'
import {
  formatCurrency,
  formatPercent,
  formatTokenAmount,
} from '@/lib/unlocks-format'
import { UnlocksNextDate } from '@/components/unlocks/unlocks-next-date'
import { cn } from '@/lib/utils'

function unlockProgressPct(unlockAt: number | null, now = Date.now()): number {
  if (unlockAt == null || unlockAt <= now) return 100
  const windowMs = 30 * 86_400_000
  const start = unlockAt - windowMs
  if (now <= start) return 0
  return Math.min(100, ((now - start) / (unlockAt - start)) * 100)
}

export const UnlocksFocusCard = memo(function UnlocksFocusCard({
  token,
}: {
  token: UnlockTokenProfile
}) {
  const countdown = useUnlockCountdown(token.nextUnlockAt)
  const progress = unlockProgressPct(token.nextUnlockAt)

  return (
    <section className="rounded-xl border border-gold/20 bg-gradient-to-br from-card via-card to-gold/[0.06] p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <TokenSymbolAvatar
          symbol={token.symbol}
          coingeckoId={token.geckoId}
          iconUrl={token.image}
          size={48}
          className="ring-2 ring-gold/20"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">{token.name}</h2>
            <UnlocksAlertDot alert={token.alert} />
          </div>
          <p className="font-mono text-sm text-muted-foreground">{token.symbol}</p>
          {token.marketCap != null && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              MCap {formatCurrency(token.marketCap, true)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UnlocksImpactBadge level={token.nextImpact} />
          <Badge variant="outline" className="border-border/80">
            {token.nextUnlockType}
          </Badge>
        </div>
      </div>

      {token.nextUnlockAt != null && (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Próximo unlock
              </p>
              <UnlocksNextDate unlockAt={token.nextUnlockAt} className="mt-1" />
              {countdown && (
                <p className="mt-1 text-xs font-mono text-gold">Countdown: {countdown}</p>
              )}
            </div>
            <UnlocksDualPct
              circPct={token.nextInflationPct}
              maxPct={token.nextSupplyPct}
              className="text-right text-sm"
            />
          </div>
          <Progress value={progress} className="h-1.5 bg-muted/50 [&>div]:bg-gold/80" />
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/50 pt-4 sm:grid-cols-4">
        <MiniMetric
          label="No mercado"
          value={formatCurrency(token.nextUnlockUsd ?? 0)}
          accent
        />
        <MiniMetric label="Tokens" value={formatTokenAmount(token.nextUnlockTokens)} />
        <MiniMetric
          label="Infl. anual est."
          value={
            token.annualInflationPct != null
              ? formatPercent(token.annualInflationPct)
              : '—'
          }
        />
        <MiniMetric label="Circulante" value={formatTokenAmount(token.circulatingSupply, true)} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
        <span>Total: {formatTokenAmount(token.totalSupply, true)}</span>
        <span>Max: {formatTokenAmount(token.maxSupply, true)}</span>
        <span className="sm:text-right">
          Falta: {formatPercent(token.remainingPct ?? 0)}
        </span>
      </div>
    </section>
  )
})

function MiniMetric({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-md bg-muted/20 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 font-mono text-sm font-semibold tabular-nums', accent && 'text-gold')}>
        {value}
      </p>
    </div>
  )
}
