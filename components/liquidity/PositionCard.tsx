'use client'

import { AlertTriangle, Info } from 'lucide-react'
import type { AggregatorLiquidityPosition } from '@/services/types'
import { RangeBar } from '@/components/liquidity/RangeBar'
import { cn } from '@/lib/utils'

function fmtUsd(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function fmtToken(n: number, sym: string) {
  if (!Number.isFinite(n)) return `— ${sym}`
  const d = n >= 1000 ? 2 : n >= 1 ? 4 : n >= 0.001 ? 6 : 8
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: d })} ${sym}`
}

function fmtApr(n: number) {
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `${n >= 1000 ? n.toFixed(0) : n.toFixed(2).replace('.', ',')}%`
}

type PositionCardProps = {
  position: AggregatorLiquidityPosition
}

export function LiquidityPositionCard({ position: p }: PositionCardProps) {
  const pnl = p.pnlPct
  const pnlTone =
    pnl != null && Number.isFinite(pnl) ? (pnl >= 0 ? 'text-emerald-500' : 'text-red-500') : 'text-muted-foreground'
  const unpriced = Boolean(p.unpricedPlaceholder)

  return (
    <article
      className={cn(
        'flex flex-col gap-4 rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md sm:p-5',
        unpriced ? 'border-sky-500/30 bg-sky-500/[0.04]' : p.inRange ? 'border-border/60' : 'border-amber-500/35 bg-amber-500/[0.03]',
      )}
    >
      {unpriced && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-800 dark:text-sky-200">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Posição CLMM sem preço nesta vista (outra DEX ou falta de dados). Liga um RPC Solana fiável e confirma o par
            no DexScreener.
          </span>
        </div>
      )}
      {!unpriced && !p.inRange && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          Posição fora do intervalo de preço — rendimento de fees pode estar limitado.
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            <span className="text-foreground">{p.token0.symbol}</span>
            <span className="mx-1.5 text-muted-foreground">/</span>
            <span className="text-foreground">{p.token1.symbol}</span>
          </h3>
          <span
            className={cn(
              'mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              unpriced
                ? 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                : p.inRange
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400',
            )}
          >
            {unpriced ? '● Sem preço (CLMM)' : p.inRange ? '● No range' : '● Fora do range'}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Valor</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{fmtUsd(p.totalValueUSD)}</p>
        </div>
      </header>

      <div className="grid gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.token0.symbol}</p>
          <p className="font-mono text-sm font-medium text-foreground">{fmtToken(p.token0.amount, p.token0.symbol)}</p>
          <p className="text-xs text-muted-foreground">~ {fmtUsd(p.token0.usdValue)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.token1.symbol}</p>
          <p className="font-mono text-sm font-medium text-foreground">{fmtToken(p.token1.amount, p.token1.symbol)}</p>
          <p className="text-xs text-muted-foreground">~ {fmtUsd(p.token1.usdValue)}</p>
        </div>
      </div>

      <RangeBar
        min={p.range.min}
        max={p.range.max}
        current={p.range.current}
        percentage={p.range.percentage}
        inRange={p.inRange}
      />

      <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fees (est.)</p>
          <p className="font-mono font-semibold tabular-nums">{fmtUsd(p.feesUSD)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">APR pool (est.)</p>
          <p className="font-mono font-semibold tabular-nums">{fmtApr(p.apr)}</p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">P&amp;L (est.)</p>
          <p className={cn('font-mono font-semibold tabular-nums', pnlTone)}>
            {pnl != null && Number.isFinite(pnl) ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2).replace('.', ',')}%` : '—'}
          </p>
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-border/30 pt-3 text-[11px] text-muted-foreground">
        <span className="rounded-md bg-muted/50 px-2 py-0.5 font-medium text-foreground/90">{p.chain}</span>
        <span className="text-muted-foreground">·</span>
        <span>{p.protocol}</span>
        {p.feeTierBps != null && (
          <>
            <span>·</span>
            <span>{(p.feeTierBps / 10_000).toFixed(2)}% fee</span>
          </>
        )}
      </footer>
    </article>
  )
}
