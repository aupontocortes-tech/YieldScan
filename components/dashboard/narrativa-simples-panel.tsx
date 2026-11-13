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
          As 5 narrativas com melhor desempenho no período de Ajustes ({periodLabel}): TVL DefiLlama + sector
          CoinGecko + volume. Clica no quadrado para ir à rede e à moeda.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {list.map((n, i) => {
          const t = toneForNarrative(String(n.id) || n.label)
          const on = selectedId === String(n.id)
          const first = i === 0
          return (
            <li key={n.id} className={first ? 'sm:col-span-2 lg:col-span-5' : undefined}>
              <button
                type="button"
                onClick={() => select(String(n.id))}
                className={cn(
                  'h-full w-full rounded-xl border bg-gradient-to-br text-left',
                  first ? 'rounded-2xl px-4 py-4 sm:px-5' : 'px-3 py-3',
                  t.border,
                  t.bg,
                  on && 'ring-2 ring-white/40',
                  clickable && 'cursor-pointer',
                )}
              >
                <p className={cn('text-[10px] font-semibold uppercase tracking-wide', first ? t.text : t.muted)}>
                  {first ? 'Nº 1 agora' : `Nº ${i + 1}`}
                </p>
                <p className={cn('mt-0.5 font-black tracking-tight', first ? 'text-3xl' : 'text-lg', t.text)}>
                  {n.label}
                </p>
                <p className={cn('mt-1 leading-snug text-foreground/80', first ? 'text-sm' : 'text-[11px]')}>
                  {n.rankWhy ?? n.simple}
                </p>
                <CoinERede n={n} l1={l1} />
                <div className="mt-2 flex flex-wrap gap-2 font-mono text-xs font-bold tabular-nums">
                  {n.tvlChange7dPct != null && (
                    <span className={n.tvlChange7dPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                      {fmtPct(n.tvlChange7dPct)} · {periodLabel}
                    </span>
                  )}
                  {n.id === 'buybacks' && n.tvlUsd != null && n.tvlUsd > 0 ? (
                    <span className="text-orange-200">{fmtBuybackUsd(n.tvlUsd)}</span>
                  ) : n.tvlUsd != null && n.tvlUsd > 0 ? (
                    <span className={t.text}>Travado {fmtUsd(n.tvlUsd)}</span>
                  ) : null}
                  {n.volume24h != null && n.volume24h > 0 && (
                    <span className="text-foreground/70">Volume {fmtUsd(n.volume24h)}</span>
                  )}
                  {(n.relatedSymbols?.length ?? 0) > 0 &&
                    n.relatedSymbols!.slice(0, 4).map((s) => (
                      <span key={s} className="rounded-md bg-black/25 px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                        {s}
                      </span>
                    ))}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
