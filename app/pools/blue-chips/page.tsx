'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { DataLoadError } from '@/components/data-load-error'
import { fetchPools, formatCurrency, formatPercent } from '@/lib/api'
import type { Pool } from '@/lib/types'
import {
  aplicarFiltroBlueChips,
  BLUE_CHIP_CHAINS,
  BLUE_CHIP_DEX_KEYWORDS,
  blueChipRisk,
  isHighSecurityBlueChipPool,
  isStableStablePair,
} from '@/lib/blue-chip-pools'
import { canonicalLlamaChain } from '@/lib/llama-chain'

type NetworkFilter = 'all' | 'Ethereum' | 'Base' | 'Solana'
type DexFilter = 'all' | 'uniswap' | 'aerodrome' | 'raydium' | 'orca'
type SortMode = 'apr' | 'liquidity' | 'risk'

function dexOf(pool: Pool): DexFilter | 'other' {
  const p = (pool.project ?? '').toLowerCase()
  if (p.includes('uniswap')) return 'uniswap'
  if (p.includes('aerodrome')) return 'aerodrome'
  if (p.includes('raydium')) return 'raydium'
  if (p.includes('orca')) return 'orca'
  return 'other'
}

export default function BlueChipsPoolsPage() {
  const [network, setNetwork] = useState<NetworkFilter>('all')
  const [dex, setDex] = useState<DexFilter>('all')
  const [sort, setSort] = useState<SortMode>('apr')

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['blue-chip-pools-source', 10_000],
    queryFn: () => fetchPools(10_000),
  })

  const rows = useMemo(() => {
    const pools = aplicarFiltroBlueChips(data ?? [])
    const filtered = pools.filter((pool) => {
      const chain = canonicalLlamaChain(pool.chain)
      if (network !== 'all' && chain !== network) return false
      const d = dexOf(pool)
      if (dex !== 'all' && d !== dex) return false
      return true
    })

    const cmpStableRiskTvlApr = (a: Pool, b: Pool) => {
      const sa = isStableStablePair(a) ? 1 : 0
      const sb = isStableStablePair(b) ? 1 : 0
      if (sa !== sb) return sb - sa
      const ra = blueChipRisk(a) === 'low' ? 1 : 0
      const rb = blueChipRisk(b) === 'low' ? 1 : 0
      if (ra !== rb) return rb - ra
      const tvl = (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0)
      if (tvl !== 0) return tvl
      return (b.apy ?? 0) - (a.apy ?? 0)
    }

    return [...filtered].sort((a, b) => {
      if (sort === 'liquidity') {
        const t = (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0)
        if (t !== 0) return t
        return (b.apy ?? 0) - (a.apy ?? 0)
      }
      if (sort === 'risk') {
        const ra = blueChipRisk(a) === 'low' ? 0 : 1
        const rb = blueChipRisk(b) === 'low' ? 0 : 1
        if (ra !== rb) return ra - rb
        return cmpStableRiskTvlApr(a, b)
      }
      if (sort === 'apr') {
        const ap = (b.apy ?? 0) - (a.apy ?? 0)
        if (ap !== 0) return ap
        return (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0)
      }
      return cmpStableRiskTvlApr(a, b)
    })
  }, [data, network, dex, sort])

  return (
    <div className="flex flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <article className="flex flex-col gap-5 rounded-2xl border border-gold/20 bg-card/35 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link href="/pools" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para Pools
              </Link>
              <h1 className="text-2xl font-bold text-foreground">Blue Chips Pools</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Pools com pelo menos 2 ativos fortes (crypto blue chips, stables e RWAs), nas redes Ethereum, Base e Solana.
              </p>
            </div>
            {isFetching && !isLoading && <span className="text-xs text-gold">Atualizando…</span>}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Select value={network} onValueChange={(v) => setNetwork(v as NetworkFilter)}>
              <SelectTrigger className="border-border/80 bg-card/80"><SelectValue placeholder="Filtrar rede" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Rede: todas</SelectItem>
                {BLUE_CHIP_CHAINS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dex} onValueChange={(v) => setDex(v as DexFilter)}>
              <SelectTrigger className="border-border/80 bg-card/80"><SelectValue placeholder="Filtrar DEX" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">DEX: todas</SelectItem>
                {BLUE_CHIP_DEX_KEYWORDS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
              <SelectTrigger className="border-border/80 bg-card/80"><SelectValue placeholder="Ordenar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="apr">Maior APR</SelectItem>
                <SelectItem value="liquidity">Maior liquidez</SelectItem>
                <SelectItem value="risk">Menor risco</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isError && <DataLoadError onRetry={() => void refetch()} />}

          <div className="overflow-hidden rounded-xl border border-border/80 bg-card/50 shadow-inner">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Par</TableHead>
                  <TableHead>Rede</TableHead>
                  <TableHead>DEX</TableHead>
                  <TableHead className="text-right">APR/APY</TableHead>
                  <TableHead className="text-right">Liquidez</TableHead>
                  <TableHead className="text-right">Volume 24h</TableHead>
                  <TableHead className="text-right">Risco</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={`s-${i}`}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-5 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-5 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-5 w-20" /></TableCell>
                    </TableRow>
                  ))}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nenhuma pool Blue Chip encontrada para este recorte.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((pool) => {
                  const risk = blueChipRisk(pool)
                  const highSecurity = isHighSecurityBlueChipPool(pool)
                  return (
                    <TableRow key={pool.pool} className="border-border/50">
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">{pool.symbol}</span>
                          {isStableStablePair(pool) && (
                            <Badge variant="outline" className="border-success/60 text-success text-[10px]">
                              100% estável
                            </Badge>
                          )}
                          {highSecurity && (
                            <Badge variant="outline" className="border-gold/60 text-gold text-[10px]">
                              Alta segurança
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{canonicalLlamaChain(pool.chain)}</TableCell>
                      <TableCell className="capitalize">{pool.project}</TableCell>
                      <TableCell className="text-right font-mono">{formatPercent(pool.apy)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(pool.tvlUsd)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {pool.volumeUsd1d != null ? formatCurrency(pool.volumeUsd1d) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={risk === 'low' ? 'border-success/60 text-success' : 'border-gold/50 text-gold'}
                        >
                          {risk === 'low' ? 'baixo' : 'médio'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="text-xs text-muted-foreground">
            Mostrando {rows.length.toLocaleString()} pool(s). Filtro: ≥2 blue chips, TVL ≥ $100K, sem memecoins, DEX/rede suportadas; ordenação inteligente por padrão.
          </div>
        </article>
      </main>
    </div>
  )
}

