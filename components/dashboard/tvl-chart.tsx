'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchHistoricalTvl, formatCurrency } from '@/lib/api'
import { SUPPORTED_CHAINS } from '@/lib/types'
import { cn } from '@/lib/utils'

type Period = '7d' | '30d' | '90d' | '1y'

const periodDays: Record<Period, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

type TvlChartProps = {
  /** Layout estreito na coluna do hub (abaixo de notícias). */
  compact?: boolean
  className?: string
}

export function TvlChart({ compact = false, className }: TvlChartProps) {
  const [period, setPeriod] = useState<Period>('30d')
  const [selectedChain, setSelectedChain] = useState<string>('all')

  const { data: chainData, isLoading } = useQuery({
    queryKey: ['historicalTvl', selectedChain === 'all' ? 'Ethereum' : selectedChain],
    queryFn: () => fetchHistoricalTvl(selectedChain === 'all' ? 'Ethereum' : selectedChain),
  })

  const chartData = useMemo(() => {
    if (!chainData) return []

    const days = periodDays[period]
    const cutoffDate = Date.now() / 1000 - days * 24 * 60 * 60

    return chainData
      .filter((d) => d.date > cutoffDate)
      .map((d) => ({
        date: new Date(d.date * 1000).toLocaleDateString('pt-PT', {
          month: 'short',
          day: 'numeric',
        }),
        tvl: d.tvl,
      }))
  }, [chainData, period])

  const chainLabel = selectedChain === 'all' ? 'Ethereum' : selectedChain
  const embedded = compact && className?.includes('border-0')
  const chartHeight = embedded ? 180 : compact ? 220 : 300

  if (isLoading) {
    return (
      <Card
        className={cn(
          compact
            ? 'border-cyan-500/20 bg-gradient-to-b from-cyan-950/30 via-card/50 to-card/30'
            : 'border-border bg-card',
          className,
        )}
      >
        <CardHeader className={compact ? 'space-y-3 px-4 pb-2 pt-4' : undefined}>
          <div className="flex flex-col gap-2">
            <Skeleton className={cn('h-5', compact ? 'w-36' : 'w-48')} />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-4' : undefined}>
          <Skeleton className="w-full" style={{ height: chartHeight }} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        compact
          ? 'border-cyan-500/20 bg-gradient-to-b from-cyan-950/30 via-card/50 to-card/30'
          : 'border-border bg-card',
        className,
      )}
    >
      <CardHeader
        className={cn(
          compact && (embedded ? 'space-y-2.5 px-4 pb-0 pt-3 sm:px-5' : 'space-y-3 px-4 pb-2 pt-4'),
        )}
      >
        {embedded ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold text-foreground">
                TVL histórico
                <span className="ml-1.5 font-normal text-muted-foreground">· {chainLabel}</span>
              </CardTitle>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedChain}
                onChange={(e) => setSelectedChain(e.target.value)}
                className="rounded-lg border border-border/50 bg-background/50 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan"
              >
                {SUPPORTED_CHAINS.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
                ))}
              </select>
              <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <TabsList className="h-8 w-full bg-muted/30">
                  <TabsTrigger value="7d" className="flex-1 px-0 text-[10px]">
                    7D
                  </TabsTrigger>
                  <TabsTrigger value="30d" className="flex-1 px-0 text-[10px]">
                    30D
                  </TabsTrigger>
                  <TabsTrigger value="90d" className="flex-1 px-0 text-[10px]">
                    90D
                  </TabsTrigger>
                  <TabsTrigger value="1y" className="flex-1 px-0 text-[10px]">
                    1A
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </>
        ) : (
          <div
            className={cn(
              'flex flex-col gap-3',
              !compact && 'gap-4 sm:flex-row sm:items-center sm:justify-between',
            )}
          >
            <CardTitle
              className={cn(
                'font-semibold text-foreground',
                compact ? 'text-sm leading-snug' : 'text-lg',
              )}
            >
              {compact ? (
                <>
                  <span className="text-cyan-400/90">TVL histórico</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {chainLabel}
                  </span>
                </>
              ) : (
                `TVL histórico — ${chainLabel}`
              )}
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <select
                value={selectedChain}
                onChange={(e) => setSelectedChain(e.target.value)}
                className={cn(
                  'w-full rounded-lg border border-border/60 bg-background/60 text-foreground focus:outline-none focus:ring-2 focus:ring-cyan',
                  compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
                )}
              >
                {SUPPORTED_CHAINS.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
                ))}
              </select>
              <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <TabsList className={cn('w-full bg-secondary/80', compact && 'h-8')}>
                  <TabsTrigger value="7d" className="flex-1 text-xs">
                    7D
                  </TabsTrigger>
                  <TabsTrigger value="30d" className="flex-1 text-xs">
                    30D
                  </TabsTrigger>
                  <TabsTrigger value="90d" className="flex-1 text-xs">
                    90D
                  </TabsTrigger>
                  <TabsTrigger value="1y" className="flex-1 text-xs">
                    1A
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className={cn(compact && (embedded ? 'px-4 pb-4 pt-2 sm:px-5' : 'px-4 pb-4 pt-0'))}>
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00e5ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2535" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b7a8f', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#1a2535' }}
              />
              <YAxis
                tick={{ fill: '#6b7a8f', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0e1520',
                  border: '1px solid #1a2535',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                labelStyle={{ color: '#f0f4f8', fontWeight: 600 }}
                itemStyle={{ color: '#00e5ff' }}
                formatter={(value: number) => [formatCurrency(value), 'TVL']}
              />
              <Area
                type="monotone"
                dataKey="tvl"
                stroke="#00e5ff"
                strokeWidth={2}
                fill="url(#tvlGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
