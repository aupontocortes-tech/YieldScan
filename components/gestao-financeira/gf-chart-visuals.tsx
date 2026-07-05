'use client'

import type { TooltipProps } from 'recharts'

/** Cores sólidas e fortes — uma por fatia do donut. */
export const PIE_SLICE_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#6366f1',
]

export const CARD_THEMES = [
  'border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-emerald-950/25 to-violet-950/20 shadow-[0_8px_32px_rgba(16,185,129,0.12)]',
  'border-sky-400/30 bg-gradient-to-br from-sky-500/15 via-blue-950/25 to-indigo-950/20 shadow-[0_8px_32px_rgba(56,189,248,0.12)]',
  'border-violet-400/30 bg-gradient-to-br from-violet-500/15 via-purple-950/25 to-fuchsia-950/20 shadow-[0_8px_32px_rgba(139,92,246,0.12)]',
  'border-amber-400/30 bg-gradient-to-br from-amber-500/15 via-orange-950/25 to-rose-950/20 shadow-[0_8px_32px_rgba(251,191,36,0.12)]',
  'border-pink-400/30 bg-gradient-to-br from-pink-500/15 via-rose-950/25 to-purple-950/20 shadow-[0_8px_32px_rgba(236,72,153,0.12)]',
  'border-cyan-400/30 bg-gradient-to-br from-cyan-500/15 via-teal-950/25 to-blue-950/20 shadow-[0_8px_32px_rgba(34,211,238,0.12)]',
]

export const BAR_INCOME_COLOR = '#22c55e'
export const BAR_EXPENSE_COLOR = '#ef4444'
export const AXIS_TICK = { fill: '#cbd5e1', fontSize: 11 }
export const GRID_STROKE = 'rgba(148, 163, 184, 0.15)'

export function ChartSvgDefs() {
  return (
    <defs>
      <linearGradient id="gf-line-net" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
        <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="gf-line-total" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.4} />
        <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
      </linearGradient>
      <filter id="gf-pie-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.35" />
      </filter>
    </defs>
  )
}

export function fmtBrlChart(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export type PieSliceRow = { name: string; value: number }

/** Valores finitos e positivos; funde fatias com o mesmo nome (evita crash do Recharts). */
export function sanitizePieSlices(rows: PieSliceRow[]): PieSliceRow[] {
  const merged = new Map<string, number>()
  for (const row of rows) {
    const name = String(row.name ?? '').trim() || 'Outros'
    const value = Number(row.value)
    if (!Number.isFinite(value) || value <= 0) continue
    merged.set(name, (merged.get(name) ?? 0) + value)
  }
  return [...merged.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export function GfChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: TooltipProps<number, string> & { valueFormatter?: (v: number) => string }) {
  if (!active || !payload?.length) return null
  const fmt = valueFormatter ?? fmtBrlChart
  return (
    <div className="rounded-xl border border-white/15 bg-slate-900/95 px-3 py-2 shadow-2xl backdrop-blur-md">
      {label ? <p className="mb-1 text-[11px] font-medium text-slate-400">{label}</p> : null}
      <ul className="space-y-1">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.color ?? '#fff' }} />
            <span className="text-slate-300">{entry.name}:</span>
            <span>{fmt(Number(entry.value ?? 0))}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function pieSliceColor(index: number): string {
  return PIE_SLICE_COLORS[index % PIE_SLICE_COLORS.length]!
}
