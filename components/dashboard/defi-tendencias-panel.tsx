'use client'

import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, Layers } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { TendenciasDefiPanel } from '@/lib/tendencias/types'
import { cn } from '@/lib/utils'

function fmtUsd(n: number | null | undefined, compact = false): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (compact) {
    const abs = Math.abs(n)
    const sign = n < 0 ? '-' : ''
    if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)} T US$`
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)} B US$`
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)} M US$`
  }
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : n >= 100 ? 0 : 2,
  }).format(n)
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function formatProtocolName(name: string): string {
  return name
    .split(/[-_]/g)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

function TvlBar({ pct, accent = 'cyan' }: { pct: number; accent?: 'cyan' | 'violet' }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          accent === 'violet' ? 'bg-violet-500/80' : 'bg-cyan-500/80',
        )}
        style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
      />
    </div>
  )
}

export function DefiTendenciasPanel({ defi }: { defi: TendenciasDefiPanel }) {
  const hasGlobal = defi.totalTvlUsd != null
  const chg = defi.tvlChange7dPct
  const chgUp = chg != null && chg >= 0
  const chainMax = Math.max(...defi.topChains.map((c) => c.tvlUsd), 1)
  const chainTotal = defi.topChains.reduce((a, c) => a + c.tvlUsd, 0)
  const protoMax = Math.max(...defi.topProtocols.map((p) => p.tvlUsd ?? 0), 1)
  const hasContent = hasGlobal || defi.topChains.length > 0 || defi.topProtocols.length > 0

  if (!hasContent) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-muted/5 px-4 py-10 text-center">
        <Layers className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">
          Não foi possível carregar dados DeFi. Tenta actualizar dentro de um minuto.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-card/60 to-card/40 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-cyan-400/90">
              Liquidez total DeFi
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
              {hasGlobal ? fmtUsd(defi.totalTvlUsd, true) : '—'}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{defi.summary}</p>
          </div>
          {chg != null && (
            <div
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-sm font-semibold tabular-nums',
                chgUp
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-red-500/30 bg-red-500/10 text-red-400',
              )}
            >
              {chgUp ? (
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              ) : (
                <ArrowDownRight className="h-4 w-4" aria-hidden />
              )}
              <span>{fmtPct(chg)}</span>
              <span className="text-[10px] font-normal text-muted-foreground">7 dias</span>
            </div>
          )}
        </div>
      </div>

      {defi.topChains.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Onde está o capital
            </h3>
            {chainTotal > 0 && (
              <span className="text-[10px] text-muted-foreground">
                Top {defi.topChains.length} redes · {fmtUsd(chainTotal, true)} nesta lista
              </span>
            )}
          </div>
          <ul className="space-y-2.5">
            {defi.topChains.map((c) => {
              const share = chainTotal > 0 ? (c.tvlUsd / chainTotal) * 100 : (c.tvlUsd / chainMax) * 100
              return (
                <li key={c.name} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 sm:gap-3">
                  <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                  <TvlBar pct={(c.tvlUsd / chainMax) * 100} />
                  <div className="text-right">
                    <span className="block font-mono text-xs font-semibold tabular-nums text-foreground">
                      {fmtUsd(c.tvlUsd, true)}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {share.toFixed(0)}%
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {defi.topProtocols.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Protocolos com maior TVL
          </h3>
          <ol className="space-y-2">
            {defi.topProtocols.map((p, i) => (
              <li
                key={`${p.name}-${p.chain}-${i}`}
                className="rounded-lg border border-border/35 bg-muted/5 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/40 text-[10px] font-bold tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{formatProtocolName(p.name)}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                          {p.chain}
                        </Badge>
                        {p.apy != null && p.apy > 0 && p.apy < 500 && (
                          <Badge
                            variant="outline"
                            className="h-5 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-400"
                          >
                            {p.apy.toFixed(1)}% APY
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {p.tvlUsd != null && (
                    <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">
                      {fmtUsd(p.tvlUsd, true)}
                    </span>
                  )}
                </div>
                {p.tvlUsd != null && (
                  <div className="mt-2 pl-8">
                    <TvlBar pct={((p.tvlUsd ?? 0) / protoMax) * 100} accent="violet" />
                  </div>
                )}
                <p className="mt-2 pl-8 text-[11px] leading-snug text-muted-foreground">
                  {p.interpretation}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Fonte: DefiLlama ·{' '}
        <Link href="/pools" className="font-medium text-cyan-400 hover:underline">
          Explorar pools de yield →
        </Link>
      </p>
    </div>
  )
}
