'use client'

import { useMemo } from 'react'
import { computeAdvancedMetrics } from '@/lib/btc/advanced-metrics'
import type { OhlcvBar } from '@/lib/btc/types'

function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-zinc-500">
        <span>{label}</span>
        <span className="font-mono text-zinc-400">{Math.round(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#d4af37]/40 to-[#d4af37]"
          style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  )
}

export function AdvancedMetricsPanel({ bars }: { bars: OhlcvBar[] }) {
  const m = useMemo(() => computeAdvancedMetrics(bars), [bars])

  if (!m) {
    return (
      <div className="rounded-xl border border-[#d4af37]/20 bg-black/50 p-4 text-sm text-zinc-500">
        Advanced metrics — need more history (60+ bars).
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#d4af37]/25 bg-[#080808] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#d4af37]/90">
        Advanced metrics (simulated / free data)
      </h3>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
        STH/LTH are <strong className="text-zinc-400">heuristic scores</strong>, not on-chain labels. Whale flags use
        volume and candle range vs recent history.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-800/80 bg-black/40 p-3">
          <p className="text-[10px] font-semibold uppercase text-cyan-400/90">STH activity (sim.)</p>
          <Meter value={m.sthScore} label="Score" />
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">{m.sthLabel}</p>
        </div>
        <div className="rounded-lg border border-zinc-800/80 bg-black/40 p-3">
          <p className="text-[10px] font-semibold uppercase text-emerald-400/90">LTH strength (sim.)</p>
          <Meter value={m.lthScore} label="Score" />
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">{m.lthLabel}</p>
        </div>
        <div
          className={cnPanel(m.whaleDetected)}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#d4af37]/90">Whale activity</p>
          <p className="mt-2 text-lg font-semibold text-white">
            {m.whaleDetected ? '🐋 Activity flagged' : 'No strong flag'}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">{m.whaleSummary}</p>
        </div>
      </div>
    </div>
  )
}

function cnPanel(whale: boolean) {
  return whale
    ? 'rounded-lg border border-cyan-500/35 bg-cyan-950/25 p-3 shadow-[inset_0_0_20px_rgba(34,211,238,0.06)]'
    : 'rounded-lg border border-zinc-800/80 bg-black/40 p-3'
}
