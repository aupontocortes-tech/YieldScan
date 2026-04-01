'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PoolFiltersComponent } from '@/components/pools/pool-filters'
import { PoolOpportunitiesNow } from '@/components/pools/pool-opportunities-now'
import { PoolTable } from '@/components/pools/pool-table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchPools, filterPools, sortPools } from '@/lib/api'
import { aplicarFiltroBlueChips, sanitizeFiltersForCuratedBlueChips } from '@/lib/blue-chip-pools'
import { PoolAprPeriod, PoolFilters, DEFAULT_FILTERS } from '@/lib/types'
import { useNovelChains } from '@/hooks/use-novel-chains'
import { DataLoadError } from '@/components/data-load-error'
import { sortPoolsWithSmartPriority, topPoolIdsBySmartScore } from '@/lib/pool-smart-rank'

export default function PoolsPage() {
  const [filters, setFilters] = useState<PoolFilters>(DEFAULT_FILTERS)
  const [period, setPeriod] = useState<PoolAprPeriod>('current')

  const aprPeriodLabel: Record<PoolAprPeriod, string> = {
    current: 'APR',
    '5m': 'APR 5 minutos',
    '10m': 'APR 10 minutos',
    '1h': 'APR 1 hora',
    '1d': 'APR 24 horas',
    '7d': 'APR 7 dias',
    '30d': 'APR 30 dias',
  }

  const {
    data: pools,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['pools', filters.tvlMin],
    queryFn: () => fetchPools(filters.tvlMin),
  })

  const poolsForExplorer = useMemo(() => {
    if (!pools?.length) return []
    if (!filters.curatedBlueChipsOnly) return pools
    return aplicarFiltroBlueChips(pools)
  }, [pools, filters.curatedBlueChipsOnly])

  /** Com lista curada ativa, evita combinações de filtro que esvaziam a tabela. */
  const filtersEffective = useMemo((): PoolFilters => {
    if (!filters.curatedBlueChipsOnly) return filters
    return sanitizeFiltersForCuratedBlueChips(filters)
  }, [filters])

  const chainOptions = useMemo(() => {
    if (!poolsForExplorer.length) return []
    return [...new Set(poolsForExplorer.map((p) => p.chain))].sort((a, b) => a.localeCompare(b))
  }, [poolsForExplorer])

  const novelChains = useNovelChains(chainOptions)

  const filteredPools = useMemo(() => {
    if (!poolsForExplorer.length) return []
    return filterPools(poolsForExplorer, filtersEffective, period)
  }, [poolsForExplorer, filtersEffective, period])

  const smartFlags = useMemo(
    () => ({
      highApr: filters.smartHighApr,
      highTvl: filters.smartHighTvl,
      lowRisk: filters.smartLowRisk,
    }),
    [filters.smartHighApr, filters.smartHighTvl, filters.smartLowRisk]
  )

  const filteredAndSortedPools = useMemo(() => {
    return sortPoolsWithSmartPriority(
      filteredPools,
      period,
      smartFlags,
      filters.sortBy,
      filters.sortDirection,
      sortPools
    )
  }, [filteredPools, period, smartFlags, filters.sortBy, filters.sortDirection])

  const smartHighlightIds = useMemo(
    () => topPoolIdsBySmartScore(filteredPools, period, smartFlags, 20),
    [filteredPools, period, smartFlags]
  )

  const handleSortChange = (sortBy: PoolFilters['sortBy']) => {
    if (filters.sortBy === sortBy) {
      setFilters((f) => ({
        ...f,
        sortDirection: f.sortDirection === 'desc' ? 'asc' : 'desc',
      }))
    } else {
      setFilters((f) => ({ ...f, sortBy, sortDirection: 'desc' }))
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <article className="flex flex-col gap-8 rounded-2xl border border-gold/20 bg-card/35 p-4 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)] backdrop-blur-md sm:p-6 lg:p-8">
          <header className="flex flex-col gap-4 border-b border-border/50 pb-6 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Explorador de Pools</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">
                  {filteredAndSortedPools.length.toLocaleString()} pools
                </span>{' '}
                no recorte atual (DefiLlama + Meteora DLMM). APR agregado pode diferir do app de cada DEX.
              </p>
              {filters.curatedBlueChipsOnly && pools && pools.length > 0 && (
                <p className="mt-2 text-sm font-medium text-success">
                  {poolsForExplorer.length.toLocaleString()} pools na lista curada «Só blue chips» neste carregamento
                  {poolsForExplorer.length < pools.length && (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      (de {pools.length.toLocaleString()} no total)
                    </span>
                  )}
                  . Liga/desliga pelo botão na barra de filtros (ao lado de APR).
                </p>
              )}
              {filters.curatedBlueChipsOnly && (
                <p className="mt-3 max-w-2xl rounded-lg border border-success/35 bg-success/10 px-3 py-2 text-xs leading-relaxed text-foreground">
                  <span className="font-semibold text-success">Só blue chips ativo:</span> prioridade{' '}
                  <span className="font-medium">Solana</span> e Ethereum; pares fortes (stables, BTC, SOL, ouro, RWA…)
                  DEXs: Raydium · Orca · Meteora (Solana) e Uniswap (Ethereum); TVL mín. $100k; sem memecoins de baixa
                  qualidade.{' '}
                  <Link href="/pools/blue-chips" className="font-medium text-gold underline-offset-2 hover:underline">
                    Vista em tabela dedicada
                  </Link>
                  .
                </p>
              )}
              {filters.curatedBlueChipsOnly &&
                poolsForExplorer.length > 0 &&
                filteredPools.length === 0 &&
                !isLoading && (
                  <p className="mt-2 max-w-2xl rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-foreground">
                    Há pools na lista curada, mas os filtros atuais (busca, rede, APR, protocolo, etc.) excluem todas.
                    Tenta limpar chips em «Ativos» ou a busca.
                  </p>
                )}
              {isFetching && !isLoading && (
                <p className="mt-2 text-xs font-medium text-gold">Atualizando lista…</p>
              )}
            </div>
            <div className="shrink-0">
              <Select value={period} onValueChange={(v) => setPeriod(v as PoolAprPeriod)}>
                <SelectTrigger className="w-[210px] border-gold/25 bg-background/60">
                  <SelectValue placeholder="Período do APR" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5m">APR 5 minutos</SelectItem>
                  <SelectItem value="10m">APR 10 minutos</SelectItem>
                  <SelectItem value="1h">APR 1 hora</SelectItem>
                  <SelectItem value="1d">APR 24 horas</SelectItem>
                  <SelectItem value="7d">APR 7 dias</SelectItem>
                  <SelectItem value="30d">APR 30 dias</SelectItem>
                  <SelectItem value="current">APR atual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </header>

          <div className="rounded-lg border border-border/50 bg-background/35 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{aprPeriodLabel[period]}: </span>
            {(period === '5m' || period === '10m' || period === '1h') &&
              'no feed atual (DefiLlama) não há série nativa intraday por pool; exibindo APR atual para comparação rápida.'}
            {period === 'current' &&
              'APR total atual (DefiLlama). Uniswap: use o link da pool — lá é estimativa da sua posição.'}
            {period === '1d' && 'Pools com dados de variação 24h; coluna APR = taxa atual.'}
            {period === '7d' && 'APR base médio ~7 dias (apyBase7d), quando existir.'}
            {period === '30d' && 'APR médio ~30 dias (apyMean30d), quando existir.'}
          </div>

          {isError && <DataLoadError onRetry={() => void refetch()} />}

          {poolsForExplorer.length > 0 && (
            <PoolOpportunitiesNow pools={poolsForExplorer} period={period} />
          )}

          <PoolFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            chainOptions={chainOptions}
            pools={poolsForExplorer}
            period={period}
          />

          <PoolTable
            pools={filteredAndSortedPools}
            isLoading={isLoading && !isError}
            filters={filtersEffective}
            period={period}
            novelChains={novelChains}
            smartHighlightIds={smartHighlightIds}
            onSortChange={handleSortChange}
          />
        </article>
      </main>
    </div>
  )
}
