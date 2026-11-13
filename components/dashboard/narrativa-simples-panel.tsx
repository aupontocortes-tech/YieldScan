'use client'

import { bestCoinForNarrative } from '@/components/dashboard/l1-redes-panel'
import { toneForNarrative } from '@/lib/tendencias/ui-colors'
import type { TendenciasL1Panel, TendenciasNarrative } from '@/lib/tendencias/types'
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

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${(abs / 1e9).toFixed(1)} B US$`
  if (abs >= 1e6) return `${(abs / 1e6).toFixed(1)} M US$`
  if (abs >= 1e3) return `${(abs / 1e3).toFixed(0)} K US$`
  return `${abs.toFixed(0)} US$`
}

function CoinERede({
  n,
  l1,
}: {
  n: TendenciasNarrative
  l1?: TendenciasL1Panel | null
}) {
  const pick = bestCoinForNarrative(l1 ?? null, n)
  if (!pick) return null
  return (
    <p className="mt-2 text-sm font-bold leading-snug">
      Melhor agora: {pick.symbol} · {pick.chain}
      {pick.change7d != null ? ` (${fmtPct(pick.change7d)} / 7d)` : ''}
    </p>
  )
}

export function NarrativaSimplesPanel({
  narratives,
  selectedId,
  onSelect,
  l1,
  periodLabel = '7 dias',
}: {
  narratives: TendenciasNarrative[]
  attentionNarrative?: string | null
  hint?: string | null
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  l1?: TendenciasL1Panel | null
  periodLabel?: string
}) {
  const list = narratives.slice(0, 5)
  if (list.length === 0) {
    return <p className="text-sm text-muted-foreground">Ainda não há temas em destaque.</p>
  }

  const [top, ...rest] = list
  const topTone = toneForNarrative(String(top.id) || top.label)
  const clickable = Boolean(onSelect)
  const select = (id: string) => {
    if (!onSelect) return
    onSelect(id)
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold tracking-tight">Temas em destaque</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Só as 5 narrativas com melhor desempenho no período escolhido em Ajustes ({periodLabel}): TVL DefiLlama +
          sector CoinGecko + volume. Não é palpite. Clica no quadrado para ir à rede e à moeda.
        </p>
      </div>

      <button
        type="button"
        onClick={() => select(String(top.id))}
        className={cn(
          'relative w-full overflow-hidden rounded-2xl border bg-gradient-to-br px-4 py-4 text-left sm:px-5',
          topTone.border,
          topTone.bg,
          selectedId === String(top.id) && 'ring-2 ring-white/40',
          clickable && 'cursor-pointer',
        )}
      >
        <p className={cn('text-[11px] font-semibold uppercase tracking-[0.14em]', topTone.text)}>Nº 1 agora</p>
        <p className={cn('mt-1 text-3xl font-black tracking-tight', topTone.text)}>{top.label}</p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/85">{top.rankWhy ?? top.simple ?? top.summary}</p>
        <CoinERede n={top} l1={l1} />
        <div className="mt-3 flex flex-wrap gap-2">
          {top.tvlChange7dPct != null && (
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                top.tvlChange7dPct >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300',
              )}
            >
              {periodLabel} {fmtPct(top.tvlChange7dPct)}
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
          {top.id !== 'buybacks' && top.tvlUsd != null && top.tvlUsd > 0 && (
            <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-bold">
              Travado {fmtUsd(top.tvlUsd)}
            </span>
          )}
          {top.volume24h != null && top.volume24h > 0 && (
            <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-bold">
              Volume {fmtUsd(top.volume24h)}
            </span>
          )}
          {(top.relatedSymbols?.length ?? 0) > 0 &&
            top.relatedSymbols!.slice(0, 4).map((s) => (
              <span key={s} className="rounded-full bg-black/25 px-2.5 py-0.5 font-mono text-[11px] font-bold">
                {s}
              </span>
            ))}
        </div>
      </button>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((n, i) => {
          const t = toneForNarrative(String(n.id) || n.label)
          const on = selectedId === String(n.id)
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => select(String(n.id))}
                className={cn(
                  'h-full w-full rounded-xl border bg-gradient-to-br px-3 py-3 text-left',
                  t.border,
                  t.bg,
                  on && 'ring-2 ring-white/40',
                  clickable && 'cursor-pointer',
                )}
              >
              <p className={cn('text-[10px] font-semibold uppercase tracking-wide', t.muted)}>Nº {i + 2}</p>
              <p className={cn('mt-0.5 text-lg font-black', t.text)}>{n.label}</p>
              <p className="mt-1 text-[11px] leading-snug text-foreground/80">{n.rankWhy ?? n.simple}</p>
              <CoinERede n={n} l1={l1} />
              <div className="mt-2 space-y-0.5 font-mono text-xs font-bold tabular-nums">
                {n.id === 'buybacks' && n.tvlUsd != null && n.tvlUsd > 0 ? (
                  <p className="text-orange-200">{fmtBuybackUsd(n.tvlUsd)}</p>
                ) : n.tvlUsd != null && n.tvlUsd > 0 ? (
                  <p className={t.text}>Travado {fmtUsd(n.tvlUsd)}</p>
                ) : null}
                {n.volume24h != null && n.volume24h > 0 && (
                  <p className="text-foreground/70">Volume {fmtUsd(n.volume24h)}</p>
                )}
                {n.tvlChange7dPct != null && (
                  <p className={n.tvlChange7dPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                    {fmtPct(n.tvlChange7dPct)} · {periodLabel}
                  </p>
                )}
              </div>
              {(n.relatedSymbols?.length ?? 0) > 0 && (
                <p className="mt-2 flex flex-wrap gap-1">
                  {n.relatedSymbols!.slice(0, 4).map((s) => (
                    <span key={s} className="rounded-md bg-black/25 px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                      {s}
                    </span>
                  ))}
                </p>
              )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
