'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/rebalance-pro/status-badge'

function formatUsd(v: number) {
  if (!Number.isFinite(v)) return '—'
  const d = Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v.toFixed(4)
  return `$${d}`
}

function AnimatedNumber({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0.4, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('font-mono tabular-nums', className)}
    >
      {formatUsd(value)}
    </motion.span>
  )
}

export type ResultCardProps = {
  newMin: number
  newMax: number
  rangeShiftPct: number
  inRange: boolean
  impermanentLossHintPct: number
  onRebalance: () => void
  className?: string
}

export function ResultCard({
  newMin,
  newMax,
  rangeShiftPct,
  inRange,
  impermanentLossHintPct,
  onRebalance,
  className,
}: ResultCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-950/90 via-violet-950/20 to-cyan-950/25 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl',
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 size-56 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="size-4 text-violet-400" aria-hidden />
            Optimized range
          </h3>
          <p className="mt-1 text-xs text-muted-foreground/90">Centered on current price with your width multiplier.</p>
        </div>
        <StatusBadge inRange={inRange} />
      </div>

      <div className="relative mt-6 grid gap-6 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">New min price</p>
          <p className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            <AnimatedNumber value={newMin} className="text-foreground" />
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">New max price</p>
          <p className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            <AnimatedNumber value={newMax} className="text-foreground" />
          </p>
        </div>
      </div>

      <div className="relative mt-6 flex flex-wrap items-center gap-6 border-t border-white/10 pt-6">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Range shift</p>
          <motion.p
            key={rangeShiftPct}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-mono text-xl font-semibold tabular-nums text-cyan-300/95"
          >
            {rangeShiftPct >= 0 ? '+' : ''}
            {rangeShiftPct.toFixed(2)}%
          </motion.p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">IL estimate (placeholder)</p>
          <p className="font-mono text-lg font-medium text-amber-200/85">~{impermanentLossHintPct.toFixed(1)}%</p>
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        className="relative mt-8 w-full gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-base font-semibold shadow-lg shadow-violet-500/25 transition hover:from-violet-500 hover:to-cyan-500"
        onClick={onRebalance}
      >
        Rebalance now
        <ArrowRight className="size-4" />
      </Button>
    </motion.div>
  )
}
