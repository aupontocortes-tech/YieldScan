'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import type { UnlockTokenProfile } from '@/services/api/types/unlocks'
import {
  formatCurrency,
  formatPercent,
  formatTokenAmount,
  formatUnlockDateExplicit,
  formatUnlockRelativeDate,
} from '@/lib/unlocks-format'

type RankRow = UnlockTokenProfile & {
  rankLabel: string
  sortValue: number
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: RankRow }>
}) {
  if (!active || !payload?.[0]?.payload) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-border/80 bg-popover/95 px-3 py-2 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        {p.image && (
          <img src={p.image} alt="" width={18} height={18} className="rounded-full" referrerPolicy="no-referrer" />
        )}
        <p className="font-semibold">{p.name} ({p.symbol})</p>
      </div>
      <p className="mt-1 text-gold">
        Falta: {formatPercent(p.remainingPct ?? 0)} · {formatCurrency(p.remainingUsd ?? 0)}
      </p>
      <p className="text-muted-foreground">
        {formatTokenAmount(p.remainingTokens)} tokens por desbloquear
      </p>
      <p className="mt-1 border-t border-border/50 pt-1">
        Próximo: {formatUnlockDateExplicit(p.nextUnlockAt)}
      </p>
      <p className="text-muted-foreground">{formatUnlockRelativeDate(p.nextUnlockAt)}</p>
    </div>
  )
}

function shortDate(tsMs: number | null): string {
  if (tsMs == null) return ''
  return new Date(tsMs).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

function CustomYAxisTick(props: {
  x?: number
  y?: number
  payload?: { value: string; index: number }
  data: RankRow[]
}) {
  const { x = 0, y = 0, payload, data } = props
  if (!payload) return null
  const row = data[payload.index]
  if (!row) return null
  return (
    <g transform={`translate(${x},${y})`}>
      {row.image ? (
        <image
          href={row.image}
          x={-68}
          y={-10}
          width={20}
          height={20}
          clipPath="inset(0% round 50%)"
        />
      ) : (
        <circle cx={-58} cy={0} r={10} fill="hsl(var(--secondary))" />
      )}
      <text
        x={-42}
        y={0}
        dy={4}
        textAnchor="start"
        fill="hsl(var(--foreground))"
        fontSize={11}
        fontWeight={600}
      >
        {row.symbol}
      </text>
    </g>
  )
}

function BarDateLabel(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  value?: number
  index?: number
  data: RankRow[]
}) {
  const { x = 0, y = 0, width = 0, height = 0, index, data } = props
  if (index == null) return null
  const row = data[index]
  if (!row?.nextUnlockAt) return null
  const label = shortDate(row.nextUnlockAt)
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      dy={4}
      textAnchor="start"
      fill="hsl(var(--muted-foreground))"
      fontSize={9}
    >
      {label}
    </text>
  )
}

export function UnlocksRankedChart({
  rows,
  title,
  isLoading,
  onSelect,
  selectedGeckoId,
}: {
  rows: UnlockTokenProfile[]
  title: string
  isLoading: boolean
  onSelect: (geckoId: string) => void
  selectedGeckoId: string | null
}) {
  const data = useMemo(() => {
    return [...rows]
      .filter((r) => (r.remainingUsd ?? 0) > 0 || (r.remainingPct ?? 0) > 0)
      .sort((a, b) => (b.remainingUsd ?? 0) - (a.remainingUsd ?? 0))
      .slice(0, 18)
      .map((r) => ({
        ...r,
        rankLabel: r.symbol,
        sortValue: r.remainingUsd ?? 0,
      }))
  }, [rows])

  if (isLoading) {
    return <Skeleton className="h-[320px] w-full rounded-xl" />
  }

  if (!data.length) {
    return (
      <Card className="border-border/50 bg-card/40">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Sem dados de supply pendente para este filtro.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 bg-card/40" id="unlocks-ranked-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Maior → menor · o que ainda falta entrar no mercado (est. USD)
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[min(480px,58vh)] w-full min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border)/0.35)" />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => formatCurrency(Number(v), true)}
              />
              <YAxis
                type="category"
                dataKey="rankLabel"
                width={76}
                tick={(tickProps) => <CustomYAxisTick {...tickProps} data={data} />}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.12)' }} />
              <Bar
                dataKey="sortValue"
                radius={[0, 4, 4, 0]}
                maxBarSize={22}
                cursor="pointer"
                onClick={(bar) => {
                  const p = bar?.payload as RankRow | undefined
                  if (p?.geckoId) onSelect(p.geckoId)
                }}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.geckoId}
                    fill={
                      entry.geckoId === selectedGeckoId
                        ? '#d4af37'
                        : 'hsl(187 85% 45% / 0.75)'
                    }
                  />
                ))}
                <LabelList
                  dataKey="sortValue"
                  content={(labelProps) => <BarDateLabel {...labelProps} data={data} />}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
          {data.slice(0, 12).map((r) => (
            <li key={r.geckoId}>
              <button
                type="button"
                onClick={() => onSelect(r.geckoId)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-muted/30"
              >
                <span className="flex items-center gap-2">
                  <TokenSymbolAvatar
                    symbol={r.symbol}
                    coingeckoId={r.geckoId}
                    iconUrl={r.image}
                    size={20}
                  />
                  <span className="font-semibold">{r.symbol}</span>
                  <span className="text-muted-foreground">{r.name}</span>
                </span>
                <span className="flex items-center gap-3 text-right">
                  <span className="font-mono text-[11px] text-foreground">
                    {formatCurrency(r.remainingUsd ?? 0)}
                  </span>
                  <span className="text-muted-foreground">
                    {r.nextUnlockAt != null
                      ? formatUnlockDateExplicit(r.nextUnlockAt)
                      : '—'}
                  </span>
                  {r.nextUnlockAt != null && (
                    <span className="text-gold">
                      {formatUnlockRelativeDate(r.nextUnlockAt)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
