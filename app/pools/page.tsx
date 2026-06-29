'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { PoolFiltersComponent } from '@/components/pools/pool-filters'
import { PoolOpportunitiesNow } from '@/components/pools/pool-opportunities-now'
import { PoolTable } from '@/components/pools/pool-table'
import { fetchPools, filterPools, sortPools } from '@/lib/api'
import { aplicarFiltroBlueChips, sanitizeFiltersForCuratedBlueChips } from '@/lib/blue-chip-pools'
import { aplicarFiltroRwa, sanitizeFiltersForCuratedRwa } from '@/lib/rwa-pools'
import { PoolAprPeriod, PoolFilters, DEFAULT_FILTERS } from '@/lib/types'
import { useNovelChains } from '@/hooks/use-novel-chains'
import { DataLoadError } from '@/components/data-load-error'
import { sortPoolsWithSmartPriority, topPoolIdsBySmartScore } from '@/lib/pool-smart-rank'
import { POOL_FLOW_STEPS } from '@/lib/pools-playful-theme'
import { cn } from '@/lib/utils'

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
    if (filters.curatedBlueChipsOnly) return aplicarFiltroBlueChips(pools)
    if (filters.curatedRwaPoolsOnly) return aplicarFiltroRwa(pools)
    return pools
  }, [pools, filters.curatedBlueChipsOnly, filters.curatedRwaPoolsOnly])

  /** Com lista curada ativa, evita combinações de filtro que esvaziam a tabela. */
  const filtersEffective = useMemo((): PoolFilters => {
    if (filters.curatedBlueChipsOnly) return sanitizeFiltersForCuratedBlueChips(filters)
    if (filters.curatedRwaPoolsOnly) return sanitizeFiltersForCuratedRwa(filters)
    return filters
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
    <div className="pools-explorer-page flex flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <article className="pools-panel animate-fade-in flex flex-col gap-8 rounded-2xl border p-4 backdrop-blur-md sm:p-6 lg:p-8">
          <header className="pools-hero-glow relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-violet-400/20 px-4 py-5 sm:px-6 sm:py-6">
            <div className="relative flex flex-wrap items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/35 bg-gradient-to-br from-cyan-500/25 to-violet-500/20 text-2xl shadow-[0_0_28px_-8px_rgba(34,211,238,0.45)]">
                <span aria-hidden>💧</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-cyan-300/90">Yield · liquidez</p>
                <h1 className="mt-0.5 bg-gradient-to-r from-pink-300 via-violet-300 to-cyan-300 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
                  Explorador de Pools
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {filteredAndSortedPools.length.toLocaleString()} pools
                  </span>{' '}
                  no recorte atual — DefiLlama + Meteora DLMM. APR agregado; confirme no DEX antes de depositar.
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
                  . Liga/desliga pelo botão «Só blue chips» na barra de filtros.
                </p>
              )}
              {filters.curatedRwaPoolsOnly && pools && pools.length > 0 && (
                <p className="mt-2 text-sm font-medium text-gold">
                  {poolsForExplorer.length.toLocaleString()} pools na lista «Pools RWA» neste carregamento
                  {poolsForExplorer.length < pools.length && (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      (de {pools.length.toLocaleString()} no total)
                    </span>
                  )}
                  . Prioridade Solana e Hyperliquid; usa os chips de rede/DEX e TVL para refinar.
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
              {filters.curatedRwaPoolsOnly && (
                <p className="mt-3 max-w-2xl rounded-lg border border-gold/35 bg-gold/10 px-3 py-2 text-xs leading-relaxed text-foreground">
                  <span className="font-semibold text-gold">Pools RWA ativo:</span> pares com ativos do mundo real
                  (ONDO, treasury, ouro, ações tokenizadas, etc.) em{' '}
                  <span className="font-medium">Solana</span>, <span className="font-medium">Hyperliquid</span> e EVMs
                  (Ethereum, Arbitrum, Base). DEXs Solana: Raydium · Orca · Meteora · Ondo. O resto (APR, TVL, rede)
                  configuras nos filtros abaixo.
                </p>
              )}
              {(filters.curatedBlueChipsOnly || filters.curatedRwaPoolsOnly) &&
                poolsForExplorer.length > 0 &&
                filteredPools.length === 0 &&
                !isLoading && (
                  <p className="mt-2 max-w-2xl rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-foreground">
                    Há pools na lista curada, mas os filtros atuais (busca, rede, APR, protocolo, etc.) excluem todas.
                    Tenta limpar chips em «Ativos» ou a busca.
                  </p>
                )}
              {isFetching && !isLoading && (
                <p className="mt-2 flex items-center gap-2 text-xs font-medium text-cyan-200/90">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-pink-300" />
                  Atualizando lista…
                </p>
              )}
              </div>
            </div>
          </header>

          <nav
            className="flex flex-wrap items-center gap-2"
            aria-label="Passos do explorador"
          >
            {POOL_FLOW_STEPS.map((step, idx) => (
              <span key={step.n} className="flex items-center gap-2">
                {idx > 0 && (
                  <span className="text-sm text-violet-400/50" aria-hidden>
                    →
                  </span>
                )}
                <span className={cn('pools-flow-pill', step.pill)}>
                  <span className={cn('pools-step-dot', step.dot)}>{step.n}</span>
                  {step.label}
                </span>
              </span>
            ))}
          </nav>

          <div className="rounded-xl border border-violet-400/20 bg-violet-500/8 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/90">{aprPeriodLabel[period]}: </span>
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
            <div className="pools-section-card p-4 sm:p-5">
              <PoolOpportunitiesNow pools={poolsForExplorer} period={period} />
            </div>
          )}

          <div className="pools-section-card p-4 sm:p-5">
            <PoolFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            chainOptions={chainOptions}
            pools={poolsForExplorer}
            period={period}
            onAprPeriodChange={setPeriod}
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="pools-step-dot pools-step-dot-cyan" aria-hidden>
                3
              </span>
              <p className="text-xs font-medium text-cyan-200/90">
                Toque numa linha da tabela para ver taxas, gráfico e link do DEX 👇
              </p>
            </div>
            <PoolTable
            pools={filteredAndSortedPools}
            isLoading={isLoading && !isError}
            filters={filtersEffective}
            period={period}
            novelChains={novelChains}
            smartHighlightIds={smartHighlightIds}
            onSortChange={handleSortChange}
            />
          </div>
        </article>
      </main>
    </div>
  )
}
