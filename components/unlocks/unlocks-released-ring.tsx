'use client'

import { useEffect, useState } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/lib/unlocks-format'

export function UnlocksReleasedRing({
  releasedPct,
  className,
}: {
  releasedPct: number | null
  className?: string
}) {
  const value = releasedPct != null ? Math.min(100, Math.max(0, releasedPct)) : null
  const remaining = value != null ? Math.max(0, 100 - value) : null
  const r = 36
  const c = 2 * Math.PI * r
  const targetOffset = value != null ? c - (value / 100) * c : c
  const [offset, setOffset] = useState(c)

  useEffect(() => {
    const t = requestAnimationFrame(() => setOffset(targetOffset))
    return () => cancelAnimationFrame(t)
  }, [targetOffset])

  const tooltipBody =
    value != null ? (
      <div className="space-y-1 text-xs">
        <p>
          <span className="text-gold">Desbloqueado:</span> {formatPercent(value)}
        </p>
        <p>
          <span className="text-cyan-400">Bloqueado:</span> {formatPercent(remaining ?? 0)}
        </p>
      </div>
    ) : (
      <p className="text-xs">Sem max supply definida</p>
    )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('flex items-center gap-3', className)}>
          <div className="relative size-[92px] shrink-0">
            <svg viewBox="0 0 88 88" className="size-full -rotate-90">
              <defs>
                <linearGradient id="unlockRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f5e6a8" />
                  <stop offset="100%" stopColor="#d4af37" />
                </linearGradient>
              </defs>
              <circle
                cx="44"
                cy="44"
                r={r}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="7"
                opacity={0.4}
              />
              {value != null && (
                <circle
                  cx="44"
                  cy="44"
                  r={r}
                  fill="none"
                  stroke="url(#unlockRingGrad)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={offset}
                  className="transition-[stroke-dashoffset] duration-700 ease-out"
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center px-1 text-center">
              <span className="text-[10px] leading-tight text-muted-foreground">no mercado</span>
              <span className="font-mono text-base font-bold leading-none text-gold">
                {value != null ? `${value.toFixed(0)}%` : '—'}
              </span>
            </div>
          </div>
          <div className="min-w-0 text-xs leading-snug">
            <p className="text-muted-foreground">
              {remaining != null ? (
                <>
                  <span className="font-mono text-foreground/90">{remaining.toFixed(0)}%</span>{' '}
                  ainda bloqueado
                </>
              ) : (
                'Supply máx. indisponível'
              )}
            </p>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="border-border bg-popover">
        {tooltipBody}
      </TooltipContent>
    </Tooltip>
  )
}
