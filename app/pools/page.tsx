'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PoolFiltersComponent } from '@/components/pools/pool-filters'
import { PoolOpportunitiesNow } from '@/components/pools/pool-opportunities-now'
import { PoolTable } from '@/components/pools/pool-table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { fetchPools, filterPools, sortPools } from '@/lib/api'
import { aplicarFiltroBlueChips, BLUE_CHIP_CHAINS } from '@/lib/blue-chip-pools'
import { canonicalLlamaChain } from '@/lib/llama-chain'
import { PoolFilters, DEFAULT_FILTERS } from '@/lib/types'
import { useNovelChains } from '@/hooks/use-novel-chains'
import { DataLoadError } from '@/components/data-load-error'
import { sortPoolsWithSmartPriority, topPoolIdsBySmartScore } from '@/lib/pool-smart-rank'
import { cn } from '@/lib/utils'

const BLUE_CHIP_CHAIN_SET = new Set<string>(BLUE_CHIP_CHAINS)

/** Redes / categoria de UI que escondem 100% das pools Blue Chip (Solana + Ethereum). */
function sanitizeFiltersForBlueChipsMode(f: PoolFilters): PoolFilters {
  let u = { ...f }
  if (f.chainCategory === 'opportunity') {
    u = { ...u, chainCategory: 'all', quickPreset: 'none' }
  }
  if (f.chains.length > 0) {
    const narrowed = f.chains.filter((c) => BLUE_CHIP_CHAIN_SET.has(canonicalLlamaChain(c)))
    u = { ...u, chains: narrowed.length === 0 ? [] : narrowed }
  }
  return u
}

export default function PoolsPage() {
  const [filters, setFilters] = useState<PoolFilters>(DEFAULT_FILTERS)
  const [period, setPeriod] = useState<'current' | '1d' | '7d' | '30d'>('current')
  /** Filtro curado Blue Chips aplicado à lista desta página (o botão dourado). */
  const [blueChipsExplorerOn, setBlueChipsExplorerOn] = useState(false)

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
    if (!blueChipsExplorerOn) return pools
    return aplicarFiltroBlueChips(pools)
  }, [pools, blueChipsExplorerOn])

  /**
   * Modo Blue Chips: só Solana e Ethereum; outras redes selecionadas esvaziam a lista.
   * O filtro de UI “só redes oportunidade” exclui essas redes → a lista curada sumia por completo.
   */
  const filtersEffective = useMemo((): PoolFilters => {
    if (!blueChipsExplorerOn) return filters
    return sanitizeFiltersForBlueChipsMode(filters)
  }, [filters, blueChipsExplorerOn])

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
              {blueChipsExplorerOn && pools && pools.length > 0 && (
                <p className="mt-2 text-sm font-medium text-success">
                  {poolsForExplorer.length.toLocaleString()} pools com critério Blue Chip neste carregamento
                  {poolsForExplorer.length < pools.length && (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      (de {pools.length.toLocaleString()} no total)
                    </span>
                  )}
                  .
                </p>
              )}
              {blueChipsExplorerOn && (
                <p className="mt-3 max-w-2xl rounded-lg border border-success/35 bg-success/10 px-3 py-2 text-xs leading-relaxed text-foreground">
                  <span className="font-semibold text-success">Blue Chips ligado:</span> prioridade{' '}
                  <span className="font-medium">Solana</span>, também Ethereum: pares entre dólar (stables), BTC, SOL,
                  ouro e RWA/ETF (ex. SPY) ou petróleo (USO) quando existirem; DEXs Raydium · Orca · Meteora… e
                  Uniswap · Curve · Balancer · Sushi; TVL mín. ~$5k neste modo; sem memecoins. Ajustamos filtros de rede se estavam
                  em «oportunidade»
                  ou só em chains onde não há Blue Chip (ex.: só Arbitrum), para a lista não ficar vazia.{' '}
                  <Link href="/pools/blue-chips" className="font-medium text-gold underline-offset-2 hover:underline">
                    Abrir vista só em tabela
                  </Link>
                  .
                </p>
              )}
              {blueChipsExplorerOn &&
                poolsForExplorer.length > 0 &&
                filteredPools.length === 0 &&
                !isLoading && (
                  <p className="mt-2 max-w-2xl rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-foreground">
                    Há pools Blue Chip, mas os filtros atuais (busca, rede, APR, protocolo, etc.) excluem todas.
                    Tenta limpar chips de rede/DEX ou a busca.
                  </p>
                )}
              {isFetching && !isLoading && (
                <p className="mt-2 text-xs font-medium text-gold">Atualizando lista…</p>
              )}
            </div>
            <div className="shrink-0">
              <div className="mb-2 flex flex-col items-stretch gap-1.5 sm:items-end">
                <Button
                  type="button"
                  aria-pressed={blueChipsExplorerOn}
                  onClick={() => {
                    setBlueChipsExplorerOn((prev) => {
                      const next = !prev
                      if (!prev && next) {
                        setFilters((f) => sanitizeFiltersForBlueChipsMode(f))
                      }
                      return next
                    })
                  }}
                  className={cn(
                    'w-full sm:w-auto',
                    blueChipsExplorerOn
                      ? 'border-2 border-success bg-gold/90 text-background shadow-[0_0_0_1px_rgba(34,197,94,0.4)] hover:bg-gold'
                      : 'bg-gold text-background hover:bg-gold/90'
                  )}
                >
                  {blueChipsExplorerOn ? 'Blue Chips · ativo' : 'Blue Chips'}
                </Button>
                <span className="text-center text-[10px] text-muted-foreground sm:text-right">
                  Liga o filtro curado nesta página.{' '}
                  <Link href="/pools/blue-chips" className="text-gold/90 underline-offset-2 hover:underline">
                    Página dedicada
                  </Link>
                </span>
              </div>
              <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                <TabsList className="grid w-full grid-cols-2 border border-gold/25 bg-background/60 p-1 sm:flex sm:w-auto sm:grid-cols-none">
                  <TabsTrigger
                    value="current"
                    className="text-xs data-[state=active]:bg-gold data-[state=active]:text-background sm:text-sm"
                  >
                    APR atual
                  </TabsTrigger>
                  <TabsTrigger
                    value="1d"
                    className="text-xs data-[state=active]:bg-gold data-[state=active]:text-background sm:text-sm"
                  >
                    24h
                  </TabsTrigger>
                  <TabsTrigger
                    value="7d"
                    className="text-xs data-[state=active]:bg-gold data-[state=active]:text-background sm:text-sm"
                  >
                    7 dias
                  </TabsTrigger>
                  <TabsTrigger
                    value="30d"
                    className="text-xs data-[state=active]:bg-gold data-[state=active]:text-background sm:text-sm"
                  >
                    30 dias
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </header>

          <div className="rounded-lg border border-border/50 bg-background/35 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
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
