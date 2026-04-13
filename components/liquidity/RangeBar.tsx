'use client'

import { cn } from '@/lib/utils'

function fmtPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n < 0.00001) return n.toExponential(2)
  if (n < 1) return n.toFixed(6)
  if (n < 1_000_000) return n.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
  return n.toExponential(2)
}

type RangeBarProps = {
  min: number
  max: number
  current: number
  /** Posição do marcador na barra (0–100); fora do range pode extrapolar */
  percentage: number
  inRange: boolean
  className?: string
}

export function RangeBar({ min, max, current, percentage, inRange, className }: RangeBarProps) {
  const thumb = Math.max(0, Math.min(100, percentage))

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span className="min-w-0 truncate font-mono normal-case">Mín. {fmtPrice(min)}</span>
        <span className="shrink-0 font-mono normal-case text-foreground">Atual {fmtPrice(current)}</span>
        <span className="min-w-0 truncate text-right font-mono normal-case">Máx. {fmtPrice(max)}</span>
      </div>
      <div className="relative h-2.5 w-full overflow-visible rounded-full bg-muted/80">
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-all duration-300',
            inRange ? 'bg-emerald-500/35' : 'bg-red-500/35',
          )}
          style={{ width: `${thumb}%` }}
        />
        <div
          className={cn(
            'absolute top-1/2 z-[1] size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-md transition-colors',
            inRange ? 'border-emerald-400 bg-emerald-500' : 'border-red-400 bg-red-500',
          )}
          style={{ left: `${thumb}%` }}
        />
      </div>
    </div>
  )
}
