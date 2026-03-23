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

type Period = '7d' | '30d' | '90d' | '1y'

const periodDays: Record<Period, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

export function TvlChart() {
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
        date: new Date(d.date * 1000).toLocaleDateString('pt-BR', {
          month: 'short',
          day: 'numeric',
        }),
        tvl: d.tvl,
      }))
  }, [chainData, period])

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-9 w-64" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            TVL Historico - {selectedChain === 'all' ? 'Ethereum' : selectedChain}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedChain}
              onChange={(e) => setSelectedChain(e.target.value)}
              className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan"
            >
              {SUPPORTED_CHAINS.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name}
                </option>
              ))}
            </select>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList className="bg-secondary">
                <TabsTrigger value="7d" className="text-xs">7D</TabsTrigger>
                <TabsTrigger value="30d" className="text-xs">30D</TabsTrigger>
                <TabsTrigger value="90d" className="text-xs">90D</TabsTrigger>
                <TabsTrigger value="1y" className="text-xs">1A</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
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
