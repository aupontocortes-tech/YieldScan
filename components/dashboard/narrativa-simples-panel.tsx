'use client'

import { toneForNarrative } from '@/lib/tendencias/ui-colors'
import type { TendenciasNarrative } from '@/lib/tendencias/types'
import { cn } from '@/lib/utils'

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function fmtBuybackUsd(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M US$ / 24h`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} K US$ / 24h`
  return `${n.toFixed(0)} US$ / 24h`
}

export function NarrativaSimplesPanel({
  narratives,
}: {
  narratives: TendenciasNarrative[]
  attentionNarrative?: string | null
  hint?: string | null
}) {
  const list = narratives.slice(0, 8)
  if (list.length === 0) {
    return <p className="text-sm text-muted-foreground">Ainda não há temas em destaque.</p>
  }

  const [top, ...rest] = list
  const topTone = toneForNarrative(String(top.id) || top.label)

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold tracking-tight">Temas em destaque</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Onde o dinheiro está a ir: TVL, CoinGecko e recompra/queima de tokens. Não é notícia — é adoção.
        </p>
      </div>

      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border bg-gradient-to-br px-4 py-4 sm:px-5',
          topTone.border,
          topTone.bg,
        )}
      >
        <p className={cn('text-[11px] font-semibold uppercase tracking-[0.14em]', topTone.text)}>Nº 1 agora</p>
        <p className={cn('mt-1 text-3xl font-black tracking-tight', topTone.text)}>{top.label}</p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/85">{top.simple ?? top.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {top.tvlChange7dPct != null && (
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                top.tvlChange7dPct >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300',
              )}
            >
              7 dias {fmtPct(top.tvlChange7dPct)}
            </span>
          )}
          {top.marketCapChange24h != null && top.id !== 'buybacks' && (
            <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-[11px]">
              Sector hoje {fmtPct(top.marketCapChange24h)}
            </span>
          )}
          {top.id === 'buybacks' && top.tvlUsd != null && top.tvlUsd > 0 && (
            <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-bold">
              {fmtBuybackUsd(top.tvlUsd)}
            </span>
          )}
          {(top.relatedSymbols?.length ?? 0) > 0 &&
            top.relatedSymbols!.slice(0, 4).map((s) => (
              <span key={s} className="rounded-full bg-black/25 px-2.5 py-0.5 font-mono text-[11px] font-bold">
                {s}
              </span>
            ))}
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((n, i) => {
          const t = toneForNarrative(String(n.id) || n.label)
          return (
            <li key={n.id} className={cn('rounded-xl border bg-gradient-to-br px-3 py-3', t.border, t.bg)}>
              <p className={cn('text-[10px] font-semibold uppercase tracking-wide', t.muted)}>Nº {i + 2}</p>
              <p className={cn('mt-0.5 text-lg font-black', t.text)}>{n.label}</p>
              <p className="mt-1 text-[11px] leading-snug text-foreground/80">{n.simple}</p>
              {n.id === 'buybacks' && n.tvlUsd != null && n.tvlUsd > 0 ? (
                <p className="mt-2 font-mono text-xs font-bold tabular-nums text-orange-200">
                  {fmtBuybackUsd(n.tvlUsd)}
                </p>
              ) : n.tvlChange7dPct != null ? (
                <p
                  className={cn(
                    'mt-2 font-mono text-xs font-bold tabular-nums',
                    n.tvlChange7dPct >= 0 ? 'text-emerald-300' : 'text-rose-300',
                  )}
                >
                  {fmtPct(n.tvlChange7dPct)} em 7 dias
                </p>
              ) : null}
              {(n.relatedSymbols?.length ?? 0) > 0 && (
                <p className="mt-2 flex flex-wrap gap-1">
                  {n.relatedSymbols!.slice(0, 4).map((s) => (
                    <span key={s} className="rounded-md bg-black/25 px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                      {s}
                    </span>
                  ))}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
