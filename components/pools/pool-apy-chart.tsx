'use client'

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
import { Skeleton } from '@/components/ui/skeleton'
import { fetchPoolChart, formatPercent } from '@/lib/api'

interface PoolApyChartProps {
  poolId: string
}

export function PoolApyChart({ poolId }: PoolApyChartProps) {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ['poolChart', poolId],
    queryFn: () => fetchPoolChart(poolId),
  })

  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground">
        Sem dados historicos disponiveis
      </div>
    )
  }

  const formattedData = chartData.slice(-30).map((d) => ({
    date: new Date(d.timestamp).toLocaleDateString('pt-BR', {
      month: 'short',
      day: 'numeric',
    }),
    apy: d.apy,
    apyBase: d.apyBase,
  }))

  return (
    <div className="h-[200px] w-full">
      <h4 className="mb-2 text-sm font-medium text-muted-foreground">
        Historico APY (30 dias)
      </h4>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="apyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2535" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6b7a8f', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#1a2535' }}
          />
          <YAxis
            tick={{ fill: '#6b7a8f', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value.toFixed(1)}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0e1520',
              border: '1px solid #1a2535',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#f0f4f8', fontWeight: 600 }}
            formatter={(value: number) => [formatPercent(value), 'APY']}
          />
          <Area
            type="monotone"
            dataKey="apy"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#apyGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
