'use client'

import type { AggregatorLiquidityPosition } from '@/services/types'
import { cn } from '@/lib/utils'

function fmtUsd(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

type SummaryProps = {
  positions: AggregatorLiquidityPosition[]
  className?: string
}

export function LiquiditySummary({ positions, className }: SummaryProps) {
  const totalValue = positions.reduce((s, p) => s + p.totalValueUSD, 0)
  const totalFees = positions.reduce((s, p) => s + p.feesUSD, 0)
  const invested = positions.reduce((s, p) => s + Math.max(0, p.totalValueUSD - p.feesUSD), 0)

  return (
    <div
      className={cn(
        'grid gap-4 rounded-xl border border-border/50 bg-gradient-to-br from-muted/40 to-muted/10 p-4 sm:grid-cols-3',
        className,
      )}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Valor total (est.)
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {fmtUsd(totalValue)}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Fees acumuladas (est.)
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {fmtUsd(totalFees)}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Posições
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {positions.length}
        </p>
        {invested > 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Principal ~ {fmtUsd(invested)}
          </p>
        )}
      </div>
    </div>
  )
}
