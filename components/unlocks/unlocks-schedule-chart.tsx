'use client'

import { useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { UnlockSchedulePoint } from '@/services/api/types/unlocks'
import {
  formatCurrency,
  formatDualSupplyPct,
  formatPercent,
  formatTokenAmount,
  formatUnlockRelativeDate,
} from '@/lib/unlocks-format'
import { IMPACT_LABEL } from '@/lib/unlocks-impact'

const TYPE_COLORS: Record<string, string> = {
  Cliff: '#d4af37',
  Linear: '#22d3ee',
  Pendente: '#f97316',
  Próximo: '#a78bfa',
}

function barColor(type: string): string {
  return TYPE_COLORS[type] ?? '#94a3b8'
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: UnlockSchedulePoint }>
}) {
  if (!active || !payload?.[0]?.payload) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-border/80 bg-popover/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-foreground">
        {formatUnlockRelativeDate(p.timestamp)} · {p.unlockType}
      </p>
      <p className="mt-1 font-mono text-gold">
        {formatTokenAmount(p.tokens)} · {formatCurrency(p.usdValue ?? 0)}
      </p>
      <p className="mt-1 text-muted-foreground">
        {formatDualSupplyPct(p.inflationPct, p.supplyPct)}
      </p>
      <p className="text-muted-foreground">Impacto: {IMPACT_LABEL[p.impact]}</p>
    </div>
  )
}

export function UnlocksScheduleChart({
  tokenName,
  series,
  isLoading,
}: {
  tokenName: string
  series: UnlockSchedulePoint[]
  isLoading: boolean
}) {
  const { data, totalUsd, totalTokens } = useMemo(() => {
    const mapped = series.map((p) => ({
      ...p,
      label: p.dateLabel,
      trend: p.tokens,
    }))
    const totalUsd = series.reduce((s, p) => s + (p.usdValue ?? 0), 0)
    const totalTokens = series.reduce((s, p) => s + p.tokens, 0)
    return { data: mapped, totalUsd, totalTokens }
  }, [series])

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full rounded-xl" />
  }

  if (!data.length) {
    return (
      <Card className="border-border/50 bg-card/40">
        <CardContent className="py-14 text-center text-sm text-muted-foreground">
          Sem unlocks previstos nos próximos 90 dias.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 bg-card/40" id="unlocks-chart-anchor">
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">Calendário — {tokenName}</CardTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Total no período: {formatCurrency(totalUsd, true)} ·{' '}
            {formatTokenAmount(totalTokens, true)} tokens
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          {['Cliff', 'Linear', 'Pendente'].map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <span
                className="size-2 rounded-sm"
                style={{ background: barColor(t) }}
              />
              {t}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.35)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => formatTokenAmount(Number(v), true)}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.15)' }} />
              <Bar dataKey="tokens" radius={[6, 6, 0, 0]} maxBarSize={40}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.unlockType)} fillOpacity={0.9} />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="trend"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                opacity={0.45}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
