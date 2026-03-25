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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ChainBadge } from '@/components/chain-badge'
import { fetchPools, formatCurrency, formatPercent, sortPools } from '@/lib/api'
import { Search, Coins, ExternalLink, TrendingUp, AlertCircle } from 'lucide-react'

const POPULAR_TOKENS = ['ETH', 'USDC', 'USDT', 'BTC', 'WBTC', 'DAI', 'SOL', 'MATIC', 'ARB', 'OP']

export function TokenPoolsSearch() {
  const [searchValue, setSearchValue] = useState('')
  const [activeToken, setActiveToken] = useState('')

  const { data: pools, isLoading } = useQuery({
    queryKey: ['pools', 10_000],
    queryFn: () => fetchPools(10_000),
  })

  const filteredPools = useMemo(() => {
    if (!pools || !activeToken) return []
    
    const tokenLower = activeToken.toLowerCase()
    const filtered = pools.filter(pool => {
      const symbolLower = pool.symbol.toLowerCase()
      // Match token in pool symbol (e.g., "ETH-USDC" contains "ETH")
      return symbolLower.includes(tokenLower) && 
             pool.apy > 0 && 
             pool.apy < 10000 && 
             pool.tvlUsd > 50000
    })
    
    return sortPools(filtered, 'apr', 'desc').slice(0, 15)
  }, [pools, activeToken])

  const handleSearch = () => {
    if (searchValue.trim()) {
      setActiveToken(searchValue.trim().toUpperCase())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleTokenClick = (token: string) => {
    setSearchValue(token)
    setActiveToken(token)
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan/10">
            <Coins className="h-5 w-5 text-cyan" />
          </div>
          <div>
            <CardTitle className="text-lg">Pools por Token</CardTitle>
            <CardDescription>Encontre as melhores pools para qualquer token</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Digite o simbolo do token (ex: ETH, USDC, SOL)"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 bg-background/50 border-border/50 focus:border-cyan"
            />
          </div>
          <Button onClick={handleSearch} className="bg-cyan hover:bg-cyan/90 text-background">
            Buscar
          </Button>
        </div>

        {/* Popular Tokens */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center mr-1">Populares:</span>
          {POPULAR_TOKENS.map((token) => (
            <Badge
              key={token}
              variant={activeToken === token ? "default" : "outline"}
              className={`cursor-pointer transition-colors ${
                activeToken === token 
                  ? 'bg-cyan text-background hover:bg-cyan/90' 
                  : 'hover:bg-muted border-border/50'
              }`}
              onClick={() => handleTokenClick(token)}
            >
              {token}
            </Badge>
          ))}
        </div>

        {/* Results */}
        {activeToken && (
          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">
                Melhores pools com <span className="text-cyan font-semibold">{activeToken}</span>
              </h3>
              {filteredPools.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {filteredPools.length} pools encontradas
                </span>
              )}
            </div>
            
            <div className="rounded-md border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-12 text-muted-foreground">#</TableHead>
                    <TableHead className="text-muted-foreground">Pool</TableHead>
                    <TableHead className="text-muted-foreground">Chain</TableHead>
                    <TableHead className="text-right text-muted-foreground">APR</TableHead>
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
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredPools.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <AlertCircle className="h-5 w-5" />
                          <span className="text-sm">Nenhuma pool encontrada para {activeToken}</span>
                          <span className="text-xs">Tente outro token ou verifique a ortografia</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPools.map((pool, index) => (
                      <TableRow 
                        key={pool.pool} 
                        className="border-border/50 transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="font-medium text-muted-foreground">
                          {index === 0 ? (
                            <TrendingUp className="h-4 w-4 text-success" />
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
                          <ChainBadge chainId={pool.chain} />
                        </TableCell>
                        <TableCell className="text-right font-mono text-success">
                          {formatPercent(pool.apy)}
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!activeToken && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Busque um token ou clique em um token popular acima
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
