'use client'

import Link from 'next/link'
import { Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { useTendencias } from '@/hooks/use-tendencias'
import { readTendenciasPrefs } from '@/lib/tendencias/prefs'
import { TRIM_CLASS_LABEL, type TrimClass } from '@/lib/tendencias/trim-config'
import type { SentimentLevel, TendenciasTokenRow } from '@/lib/tendencias/types'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { HubPanel } from '@/components/dashboard/hub/hub-panel'
import { cn } from '@/lib/utils'

const SENTIMENT: Record<
  SentimentLevel,
  { label: string; ring: string; bg: string; text: string }
> = {
  optimista: {
    label: 'Optimista',
    ring: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
  },
  pessimista: {
    label: 'Pessimista',
    ring: 'border-red-500/40',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
  },
  neutro: {
    label: 'Neutro',
    ring: 'border-amber-500/35',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
  },
}

const TRIM_DOT: Record<TrimClass, string> = {
  acelerando: 'bg-yellow-400',
  forte: 'bg-emerald-400',
  estavel: 'bg-amber-400',
  fraco: 'bg-red-400',
}

function fmtUsdShort(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`
  return `${sign}${abs.toFixed(0)}`
}

function TokenMoverRow({ row }: { row: TendenciasTokenRow }) {
  const ch = row.changePeriod ?? row.change24h
  const up = ch != null && ch >= 0
  return (
    <Link
      href={`/token/${encodeURIComponent(row.symbol)}`}
      className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-background/40 px-2.5 py-2 transition-all duration-200 hover:border-white/10 hover:bg-muted/15 hover:shadow-[0_6px_20px_-12px_rgba(0,0,0,0.6)]"
    >
      <TokenSymbolAvatar symbol={row.symbol} coingeckoId={row.id} size={28} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-foreground">{row.symbol}</span>
          <span
            className={cn('h-1.5 w-1.5 rounded-full', TRIM_DOT[row.trimClass] ?? 'bg-muted-foreground')}
            title={TRIM_CLASS_LABEL[row.trimClass]}
          />
        </div>
        <p className="truncate text-[10px] text-muted-foreground">{row.momentumLabel}</p>
      </div>
      {ch != null && (
        <span
          className={cn(
            'shrink-0 font-mono text-[11px] font-semibold tabular-nums',
            up ? 'text-emerald-400' : 'text-red-400',
          )}
        >
          {up ? '+' : ''}
          {ch.toFixed(1)}%
        </span>
      )}
    </Link>
  )
}

export function HubTendencias() {
  const prefs = readTendenciasPrefs()
  const { data, isLoading, isError } = useTendencias(prefs)

  const market = data?.market
  const sentiment = market?.sentiment ?? 'neutro'
  const sentUi = SENTIMENT[sentiment]
  const movers =
    data?.buckets.acelerando.slice(0, 3) ??
    data?.buckets.maisPositivos.slice(0, 3) ??
    []
  const narrative = data?.narratives[0]
  const defi = data?.defi

  return (
    <HubPanel
      title="Tendências"
      subtitle="Score, narrativas e pulso do mercado"
      icon={Sparkles}
      accent="yellow"
      href="/news/tendencias"
      linkLabel="Análise completa"
      className="min-h-0"
    >
      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}

      {!isLoading && (isError || !data) && (
        <p className="text-xs text-muted-foreground">Tendências indisponíveis.</p>
      )}

      {!isLoading && data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                sentUi.ring,
                sentUi.bg,
                sentUi.text,
              )}
            >
              {sentiment === 'optimista' ? (
                <TrendingUp className="h-3 w-3" />
              ) : sentiment === 'pessimista' ? (
                <TrendingDown className="h-3 w-3" />
              ) : null}
              {sentUi.label}
            </span>
            <span className="rounded-full border border-border/50 bg-muted/20 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
              Índice {market?.trendIndex ?? '—'}/100
            </span>
            {market && (
              <span className="text-[10px] text-muted-foreground">
                <span className="text-emerald-400">{market.gainersCount}</span> altas ·{' '}
                <span className="text-red-400">{market.losersCount}</span> baixas (24h)
              </span>
            )}
          </div>

          {data.observeToday && (
            <p className="rounded-xl border border-white/[0.06] bg-muted/10 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground ring-1 ring-white/[0.03]">
              {data.observeToday}
            </p>
          )}

          {narrative && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-yellow-500/90">
                Narrativa · {narrative.label}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{narrative.summary}</p>
            </div>
          )}

          {movers.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Em destaque
              </p>
              <ul className="space-y-1.5">
                {movers.map((row) => (
                  <li key={row.id}>
                    <TokenMoverRow row={row} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {defi?.totalTvlUsd != null && (
            <div className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">TVL DeFi agregado</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-cyan-300">
                {fmtUsdShort(defi.totalTvlUsd)} US$
                {defi.tvlChange7dPct != null && (
                  <span
                    className={cn(
                      'ml-1.5',
                      defi.tvlChange7dPct >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {defi.tvlChange7dPct >= 0 ? '+' : ''}
                    {defi.tvlChange7dPct.toFixed(1)}% 7d
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </HubPanel>
  )
}
