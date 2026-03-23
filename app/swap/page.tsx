'use client'

import { useState, useMemo } from 'react'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { SUPPORTED_CHAINS } from '@/lib/types'
import { formatNumber } from '@/lib/api'
import { ArrowDownUp, ExternalLink, Sparkles, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Common tokens for swap
const COMMON_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
  { symbol: 'USDC', name: 'USD Coin', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
  { symbol: 'USDT', name: 'Tether USD', address: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599' },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6b175474e89094c44da98b954eedeac495271d0f' },
  { symbol: 'LINK', name: 'Chainlink', address: '0x514910771af9ca656af840dff83e8264ecf986ca' },
  { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' },
  { symbol: 'AAVE', name: 'Aave', address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9' },
]

// Mock DEX quotes data (since 1inch API requires API key)
const MOCK_DEX_QUOTES = [
  { dex: 'Uniswap V3', chain: 'Ethereum', rate: 1.0, gas: 150000, bestPrice: true },
  { dex: 'Curve', chain: 'Ethereum', rate: 0.9985, gas: 180000, bestPrice: false },
  { dex: 'Balancer', chain: 'Ethereum', rate: 0.9978, gas: 165000, bestPrice: false },
  { dex: 'SushiSwap', chain: 'Ethereum', rate: 0.9972, gas: 155000, bestPrice: false },
  { dex: 'Uniswap V3', chain: 'Arbitrum', rate: 0.9995, gas: 85000, bestPrice: false },
  { dex: 'Camelot', chain: 'Arbitrum', rate: 0.9988, gas: 90000, bestPrice: false },
  { dex: 'Velodrome', chain: 'Optimism', rate: 0.9990, gas: 80000, bestPrice: false },
  { dex: 'Aerodrome', chain: 'Base', rate: 0.9992, gas: 75000, bestPrice: false },
]

export default function SwapPage() {
  const [fromToken, setFromToken] = useState<string>('ETH')
  const [toToken, setToToken] = useState<string>('USDC')
  const [amount, setAmount] = useState<string>('1')
  const [isLoading, setIsLoading] = useState(false)
  const [quotes, setQuotes] = useState<typeof MOCK_DEX_QUOTES | null>(null)

  const handleSwapTokens = () => {
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
    setQuotes(null)
  }

  const handleGetQuotes = async () => {
    if (!amount || parseFloat(amount) <= 0) return

    setIsLoading(true)
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Generate mock quotes based on input
    const baseAmount = parseFloat(amount)
    const mockQuotes = MOCK_DEX_QUOTES.map((quote, index) => ({
      ...quote,
      outputAmount: baseAmount * quote.rate * (toToken === 'USDC' ? 3500 : 1),
      bestPrice: index === 0,
    }))
    
    setQuotes(mockQuotes as typeof MOCK_DEX_QUOTES)
    setIsLoading(false)
  }

  const sortedQuotes = useMemo(() => {
    if (!quotes) return []
    return [...quotes].sort((a, b) => (b as { outputAmount: number }).outputAmount - (a as { outputAmount: number }).outputAmount)
  }, [quotes])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Comparador de Swap</h1>
          <p className="mt-1 text-muted-foreground">
            Compare precos de swap entre DEXs e encontre a melhor cotacao
          </p>
        </div>

        {/* Swap Input Card */}
        <Card className="mb-8 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Configurar Swap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* From Token */}
            <div className="space-y-2">
              <Label>Token de Origem</Label>
              <div className="flex gap-3">
                <Select value={fromToken} onValueChange={setFromToken}>
                  <SelectTrigger className="w-[180px] bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TOKENS.map((token) => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        <span className="font-medium">{token.symbol}</span>
                        <span className="ml-2 text-muted-foreground">{token.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-secondary border-border font-mono"
                />
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="icon"
                onClick={handleSwapTokens}
                className="rounded-full border-border bg-secondary hover:bg-muted"
              >
                <ArrowDownUp className="h-4 w-4" />
              </Button>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <Label>Token de Destino</Label>
              <Select value={toToken} onValueChange={setToToken}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TOKENS.filter(t => t.symbol !== fromToken).map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      <span className="font-medium">{token.symbol}</span>
                      <span className="ml-2 text-muted-foreground">{token.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Get Quotes Button */}
            <Button
              onClick={handleGetQuotes}
              disabled={isLoading || !amount || parseFloat(amount) <= 0}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isLoading ? 'Buscando cotacoes...' : 'Buscar Cotacoes'}
            </Button>
          </CardContent>
        </Card>

        {/* Info Alert */}
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <AlertCircle className="h-5 w-5 text-cyan shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Nota sobre cotacoes</p>
            <p>
              As cotacoes exibidas sao simuladas para demonstracao. Para cotacoes reais em tempo real,
              conecte sua API key do 1inch nas variaveis de ambiente.
            </p>
          </div>
        </div>

        {/* Quotes Table */}
        {isLoading && (
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-24 ml-auto" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {quotes && !isLoading && (
          <Card className="border-border bg-card overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">
                Cotacoes para {amount} {fromToken} → {toToken}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">DEX</TableHead>
                    <TableHead className="text-muted-foreground">Chain</TableHead>
                    <TableHead className="text-right text-muted-foreground">Quantidade</TableHead>
                    <TableHead className="text-right text-muted-foreground">Gas Est.</TableHead>
                    <TableHead className="w-[140px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedQuotes.map((quote, index) => {
                    const isBest = index === 0
                    const outputAmount = (quote as { outputAmount?: number }).outputAmount

                    return (
                      <TableRow 
                        key={`${quote.dex}-${quote.chain}`}
                        className={cn(
                          'table-row-animate border-border',
                          isBest && 'bg-success/5'
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{quote.dex}</span>
                            {isBest && (
                              <Badge className="bg-gold text-background gap-1">
                                <Sparkles className="h-3 w-3" />
                                MELHOR PRECO
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ChainBadge chain={quote.chain} />
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn(
                            'font-mono font-semibold',
                            isBest ? 'text-success' : 'text-foreground'
                          )}>
                            {outputAmount ? formatNumber(outputAmount, 4) : '-'} {toToken}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-muted-foreground text-sm">
                            ~{quote.gas.toLocaleString()} gas
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 w-full"
                            asChild
                          >
                            <a
                              href={`https://app.uniswap.org/swap?inputCurrency=${fromToken}&outputCurrency=${toToken}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Abrir DEX
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
