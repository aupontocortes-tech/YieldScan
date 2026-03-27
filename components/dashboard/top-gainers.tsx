'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ChainBadge } from '@/components/chain-badge'
import { fetchPools, formatCurrency, formatPercent, getChangeIndicator } from '@/lib/api'
import { Pool } from '@/lib/types'
import { TrendingUp, Flame, ExternalLink } from 'lucide-react'

type TimePeriod = '5m' | '10m' | '1h' | '24h' | '7d' | '30d'

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '5m', label: '5 min' },
  { value: '10m', label: '10 min' },
  { value: '1h', label: '1 hora' },
  { value: '24h', label: '24 horas' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
]

function getPoolChangeValue(pool: Pool, period: TimePeriod): number | null {
  switch (period) {
    case '5m':
    case '10m':
    case '1h':
      // DefiLlama nao tem 5m/10m/1h; aproximamos pela variacao % 24h do APR
      return pool.apyPct1D ?? null
    case '24h':
      return pool.apyPct1D ?? null
    case '7d':
      return pool.apyPct7D ?? null
    case '30d':
      return pool.apyPct30D ?? null
    default:
      return null
  }
}

function sortPoolsByPeriod(pools: Pool[], period: TimePeriod): Pool[] {
  return [...pools]
    .filter(pool => {
      const change = getPoolChangeValue(pool, period)
      return change !== null && change > 0 && pool.tvlUsd > 100000 && pool.apy > 0 && pool.apy < 10000
    })
    .sort((a, b) => {
      const changeA = getPoolChangeValue(a, period) ?? 0
      const changeB = getPoolChangeValue(b, period) ?? 0
      return changeB - changeA
    })
    .slice(0, 10)
}

export function TopGainers() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('24h')

  const { data: pools, isLoading } = useQuery({
    queryKey: ['pools', 10_000],
    queryFn: () => fetchPools(10_000),
  })

  const topGainers = useMemo(() => {
    if (!pools) return []
    return sortPoolsByPeriod(pools, selectedPeriod)
  }, [pools, selectedPeriod])

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <CardTitle className="text-lg">Maiores Ganhos</CardTitle>
              <CardDescription>Pools com maior variacao positiva de APR</CardDescription>
            </div>
          </div>
        </div>
        <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as TimePeriod)} className="mt-4">
          <TabsList className="grid w-full grid-cols-6">
            {TIME_PERIODS.map((period) => (
              <TabsTrigger 
                key={period.value} 
                value={period.value}
                className="text-xs data-[state=active]:bg-success/20 data-[state=active]:text-success"
              >
                {period.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="w-12 text-muted-foreground">#</TableHead>
                <TableHead className="text-muted-foreground">Pool</TableHead>
                <TableHead className="text-muted-foreground">Chain</TableHead>
                <TableHead className="text-right text-muted-foreground">APR atual</TableHead>
                <TableHead className="text-right text-muted-foreground">Variacao</TableHead>
                <TableHead className="text-right text-muted-foreground">TVL</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border/50">
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  </TableRow>
                ))
              ) : topGainers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Nenhuma pool com variacao positiva encontrada para este periodo.
                  </TableCell>
                </TableRow>
              ) : (
                topGainers.map((pool, index) => {
                  const change = getPoolChangeValue(pool, selectedPeriod)
                  const changeIndicator = getChangeIndicator(change)
                  return (
                    <TableRow 
                      key={pool.pool} 
                      className="border-border/50 transition-colors hover:bg-muted/50"
                    >
                      <TableCell className="font-medium text-muted-foreground">
                        {index === 0 ? (
                          <Flame className="h-4 w-4 text-warning" />
                        ) : (
                          index + 1
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">{pool.symbol}</div>
                          <div className="text-xs text-muted-foreground">{pool.project}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ChainBadge chain={pool.chain} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-success">
                        {formatPercent(pool.apy)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${changeIndicator.color}`}>
                        {changeIndicator.text}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {formatCurrency(pool.tvlUsd)}
                      </TableCell>
                      <TableCell>
                        {pool.url ? (
                          <a 
                            href={pool.url} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground transition-colors hover:text-cyan"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/50">
                            <ExternalLink className="h-4 w-4" />
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
