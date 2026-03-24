'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChainBadge } from '@/components/chain-badge'
import { fetchPools, formatCurrency, formatPercent, getAprColorClass, sortPools } from '@/lib/api'
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock price data generator
function generateMockPriceData(symbol: string) {
  const basePrice = symbol === 'ETH' ? 3500 : symbol === 'BTC' ? 95000 : symbol === 'USDC' ? 1 : 50
  const data = []
  const now = Date.now()
  
  for (let i = 30; i >= 0; i--) {
    const variation = (Math.random() - 0.5) * 0.1 * basePrice
    data.push({
      date: new Date(now - i * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR', {
        month: 'short',
        day: 'numeric',
      }),
      price: basePrice + variation,
    })
  }
  
  return data
}

export default function TokenPage() {
  const params = useParams()
  const symbol = (params.symbol as string)?.toUpperCase() || 'ETH'

  const { data: pools, isLoading: poolsLoading } = useQuery({
    queryKey: ['pools'],
    queryFn: fetchPools,
  })

  // Filter pools that contain this token
  const tokenPools = useMemo(() => {
    if (!pools) return []
    
    return sortPools(
      pools.filter(pool => 
        pool.symbol.toUpperCase().includes(symbol) ||
        pool.underlyingTokens?.some(t => t.toUpperCase().includes(symbol))
      ),
      'apr',
      'desc'
    ).slice(0, 20)
  }, [pools, symbol])

  // Mock price data
  const priceData = useMemo(() => generateMockPriceData(symbol), [symbol])
  
  const currentPrice = priceData[priceData.length - 1]?.price || 0
  const previousPrice = priceData[priceData.length - 2]?.price || currentPrice
  const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100
  const isPositive = priceChange >= 0

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link href="/pools">
          <Button variant="ghost" size="sm" className="mb-6 gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Pools
          </Button>
        </Link>

        {/* Token Header */}
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{symbol}</h1>
              <Badge variant="outline" className="border-border">
                Token
              </Badge>
            </div>
            <p className="mt-2 text-muted-foreground">
              {tokenPools.length} pools encontrados com {symbol}
            </p>
          </div>
          
          <Card className="border-border bg-card sm:min-w-[280px]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Preco Atual</span>
                <div className={cn(
                  'flex items-center gap-1 text-sm font-medium',
                  isPositive ? 'text-success' : 'text-destructive'
                )}>
                  {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
                </div>
              </div>
              <div className="mt-1 font-mono text-2xl font-bold text-foreground">
                {formatCurrency(currentPrice, false)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Price Chart */}
        <Card className="mb-8 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Historico de Preco (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={priceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
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
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0e1520',
                      border: '1px solid #1a2535',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#f0f4f8', fontWeight: 600 }}
                    formatter={(value: number) => [formatCurrency(value, false), 'Preco']}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={isPositive ? '#22c55e' : '#ef4444'}
                    strokeWidth={2}
                    fill="url(#priceGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pools with this Token */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Pools com {symbol}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {poolsLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-16 ml-auto" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : tokenPools.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                Nenhum pool encontrado com {symbol}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Pool</TableHead>
                    <TableHead className="text-muted-foreground">Chain</TableHead>
                    <TableHead className="text-right text-muted-foreground">APR</TableHead>
                    <TableHead className="text-right text-muted-foreground">TVL</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokenPools.map((pool, index) => (
                    <TableRow 
                      key={pool.pool}
                      className="table-row-animate border-border hover:bg-secondary/30"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{pool.symbol}</span>
                          <span className="text-xs text-muted-foreground">{pool.project}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ChainBadge chain={pool.chain} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn('font-mono font-semibold', getAprColorClass(pool.apy))}>
                          {formatPercent(pool.apy)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-muted-foreground">
                          {formatCurrency(pool.tvlUsd)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {pool.url ? (
                          <a href={pool.url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-cyan" />
                            </Button>
                          </a>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                            <ExternalLink className="h-4 w-4 text-muted-foreground/50" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
