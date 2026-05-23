'use client'

import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { VestingTimeline } from '@/lib/unlocks-vesting-timeline'
import { vestingCategoryColor } from '@/lib/unlocks-vesting-timeline'
import {
  formatCurrency,
  formatTokenAmount,
  formatUnlockDateExplicit,
} from '@/lib/unlocks-format'

function VestingTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0)
  return (
    <div className="rounded-lg border border-border/80 bg-popover/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 font-mono text-gold">Total: {formatTokenAmount(total)}</p>
      <ul className="mt-2 space-y-0.5">
        {[...payload].reverse().map((p) => (
          <li key={p.name} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-mono tabular-nums">{formatTokenAmount(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function UnlocksVestingChart({
  tokenName,
  timeline,
  isLoading,
}: {
  tokenName: string
  timeline: VestingTimeline | null | undefined
  isLoading: boolean
}) {
  const { data, categories, nowLabel, futureUnlocks } = useMemo(() => {
    if (!timeline?.points?.length) {
      return { data: [], categories: [] as string[], nowLabel: null as string | null, futureUnlocks: [] }
    }
    const nowMs = Date.now()
    const points = timeline.points
    let closest = points[0]!
    for (const p of points) {
      if ((p.timestamp as number) <= nowMs) closest = p
      else break
    }
    return {
      data: points,
      categories: timeline.categories,
      nowLabel: closest.label as string,
      futureUnlocks: timeline.futureUnlocks.slice(0, 5),
    }
  }, [timeline])

  if (isLoading) {
    return <Skeleton className="h-[340px] w-full rounded-xl" />
  }

  if (!data.length) {
    return (
      <Card className="border-border/50 bg-card/40">
        <CardContent className="py-14 text-center text-sm text-muted-foreground">
          Sem dados de vesting para {tokenName}.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 bg-card/40" id="unlocks-chart-anchor">
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">Vesting — {tokenName}</CardTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Supply desbloqueado por categoria ao longo do tempo
          </p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {categories.map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1">
              <span className="size-2 rounded-sm" style={{ background: vestingCategoryColor(cat) }} />
              {cat}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.35)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => formatTokenAmount(Number(v), true)}
                width={52}
              />
              <Tooltip content={<VestingTooltip />} />
              {nowLabel && (
                <ReferenceLine
                  x={nowLabel}
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  label={{
                    value: 'Este mês',
                    position: 'insideTopRight',
                    fill: '#f59e0b',
                    fontSize: 10,
                  }}
                />
              )}
              {categories.map((cat) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stackId="vesting"
                  stroke={vestingCategoryColor(cat)}
                  fill={vestingCategoryColor(cat)}
                  fillOpacity={0.72}
                  strokeWidth={0.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {futureUnlocks.length > 0 && (
          <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Próximos eventos
            </p>
            <ul className="mt-2 divide-y divide-border/30">
              {futureUnlocks.map((ev, i) => (
                <li
                  key={`${ev.at}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm first:pt-0 last:pb-0"
                >
                  <span className="font-mono font-medium text-foreground">
                    {formatUnlockDateExplicit(ev.at)}
                  </span>
                  <span className="text-xs text-muted-foreground">{ev.category}</span>
                  <span className="font-mono text-xs tabular-nums text-gold">
                    {formatTokenAmount(ev.tokens)}
                    {ev.usd != null ? ` · ${formatCurrency(ev.usd, true)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
