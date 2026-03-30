'use client'

import { useCallback, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DEFAULT_FILTERS,
  type Pool,
  type PoolAprPeriod,
  type PoolFilters,
} from '@/lib/types'
import { poolDisplayApr } from '@/lib/api'
import { aggregateProtocols } from '@/lib/pool-smart-rank'
import {
  poolMatchesSelectedChains,
  primaryChainsPresentInData,
  secondaryChainsInData,
} from '@/lib/curated-markets'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const TVL_PRESETS: { label: string; value: number }[] = [
  { label: '+10K', value: 10_000 },
  { label: '+100K', value: 100_000 },
  { label: '+1M', value: 1_000_000 },
]

function formatDexLabel(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

const chipClass =
  'shrink-0 cursor-pointer whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors'

interface PoolFiltersProps {
  filters: PoolFilters
  onFiltersChange: (filters: PoolFilters) => void
  chainOptions: string[]
  pools: Pool[]
  period: PoolAprPeriod
}

export function PoolFiltersComponent({
  filters,
  onFiltersChange,
  chainOptions,
  pools,
  period,
}: PoolFiltersProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [moreChainsOpen, setMoreChainsOpen] = useState(false)
  const [expandDexList, setExpandDexList] = useState(false)

  const aprOf = useCallback((p: Pool) => poolDisplayApr(p, period), [period])

  const updateFilter = <K extends keyof PoolFilters>(key: K, value: PoolFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value, quickPreset: 'none' })
  }

  const primaryChains = useMemo(() => primaryChainsPresentInData(chainOptions), [chainOptions])
  const extraChains = useMemo(() => secondaryChainsInData(chainOptions), [chainOptions])

  const curatedAggs = useMemo(
    () => aggregateProtocols(pools, filters.chains, { curatedOnly: true, aprOf }),
    [pools, filters.chains, aprOf]
  )

  const visibleCurated = useMemo(() => curatedAggs.slice(0, 8), [curatedAggs])

  const moreProtocolAggs = useMemo(() => {
    if (!expandDexList) return []
    const hide = new Set(visibleCurated.map((a) => a.project))
    return aggregateProtocols(pools, filters.chains, { curatedOnly: false, aprOf }).filter(
      (a) => !hide.has(a.project)
    )
  }, [expandDexList, pools, filters.chains, aprOf, visibleCurated])

  const pruneProtocols = (nextChains: string[]) => {
    const allowed = new Set(
      pools.filter((p) => poolMatchesSelectedChains(p, nextChains)).map((p) => p.project)
    )
    return filters.protocols.filter((pr) => allowed.has(pr))
  }

  const toggleChain = (chainId: string) => {
    const newChains = filters.chains.includes(chainId)
      ? filters.chains.filter((c) => c !== chainId)
      : [...filters.chains, chainId]
    onFiltersChange({
      ...filters,
      chains: newChains,
      protocols: pruneProtocols(newChains),
      quickPreset: 'none',
    })
  }

  const toggleProtocol = (protocol: string) => {
    const newProtocols = filters.protocols.includes(protocol)
      ? filters.protocols.filter((p) => p !== protocol)
      : [...filters.protocols, protocol]
    onFiltersChange({ ...filters, protocols: newProtocols, quickPreset: 'none' })
  }

  const clearFilters = () => {
    setExpandDexList(false)
    onFiltersChange({ ...DEFAULT_FILTERS, search: filters.search })
  }

  const activeTotal =
    filters.chains.length +
    filters.protocols.length +
    (filters.tvlMin !== DEFAULT_FILTERS.tvlMin ? 1 : 0) +
    (filters.smartHighApr ? 1 : 0) +
    (filters.smartHighTvl ? 1 : 0) +
    (filters.smartLowRisk ? 1 : 0) +
    (filters.safeAprProfile ? 1 : 0) +
    (filters.search.trim() ? 1 : 0)

  const toggleSafeAprProfile = () => {
    const next = !filters.safeAprProfile
    onFiltersChange({
      ...filters,
      safeAprProfile: next,
      quickPreset: 'none',
      ...(next ? { sortBy: 'apr' as const, sortDirection: 'desc' as const } : {}),
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Busca — destaque tipo “lab” */}
      <div
        className={cn(
          'rounded-xl border-2 border-gold/45 bg-background/60 p-0.5 transition-shadow',
          'focus-within:border-gold/80 focus-within:shadow-[0_0_0_3px_rgba(232,197,71,0.18)]'
        )}
      >
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gold/80" />
          <Input
            placeholder="Buscar par, token ou protocolo (ex.: btc, eth/usdt)…"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value, quickPreset: 'none' })}
            className="h-11 border-0 bg-transparent pl-11 pr-3 text-base shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Redes — faixa horizontal */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Redes
          </Label>
          <span className="text-[10px] text-muted-foreground">
            Nenhuma selecionada = todas · role para ver mais
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {primaryChains.length === 0 ? (
            <span className="text-xs text-muted-foreground">Carregando…</span>
          ) : (
            primaryChains.map((chain) => (
              <button
                key={chain}
                type="button"
                className={cn(
                  chipClass,
                  filters.chains.includes(chain)
                    ? 'border-gold/70 bg-gold/15 text-gold'
                    : 'border-border/80 bg-card/80 text-foreground hover:border-gold/40'
                )}
                onClick={() => toggleChain(chain)}
              >
                {chain}
              </button>
            ))
          )}
          {extraChains.length > 0 && (
            <Dialog open={moreChainsOpen} onOpenChange={setMoreChainsOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className={cn(chipClass, 'border-dashed border-gold/50 text-gold hover:bg-gold/10')}
                >
                  + Mais redes
                </button>
              </DialogTrigger>
              <DialogContent className="max-h-[min(80vh,28rem)] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Outras redes</DialogTitle>
                </DialogHeader>
                <div className="flex flex-wrap gap-1.5">
                  {extraChains.map((chain) => (
                    <button
                      key={chain}
                      type="button"
                      className={cn(
                        chipClass,
                        filters.chains.includes(chain)
                          ? 'border-gold/70 bg-gold/15 text-gold'
                          : 'border-border bg-card hover:border-gold/40'
                      )}
                      onClick={() => toggleChain(chain)}
                    >
                      {chain}
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* DEX / protocolos */}
      <div className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          DEX / protocolo
        </Label>
        <div className="flex flex-wrap gap-1.5 sm:flex-nowrap sm:overflow-x-auto sm:pb-1">
          {visibleCurated.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              {pools.length === 0 ? 'Carregando…' : 'Nenhuma DEX curada neste recorte.'}
            </span>
          ) : (
            visibleCurated.map((agg) => (
              <button
                key={agg.project}
                type="button"
                title={agg.project}
                className={cn(
                  chipClass,
                  'max-w-[11rem] truncate sm:max-w-none',
                  filters.protocols.includes(agg.project)
                    ? 'border-gold/70 bg-gold/15 text-gold'
                    : 'border-border/80 bg-card/80 hover:border-gold/40'
                )}
                onClick={() => toggleProtocol(agg.project)}
              >
                {formatDexLabel(agg.project)}
              </button>
            ))
          )}
        </div>
        <button
          type="button"
          className="text-xs font-medium text-gold hover:underline"
          onClick={() => setExpandDexList((e) => !e)}
        >
          {expandDexList ? 'Ver menos protocolos' : 'Ver mais protocolos'}
        </button>
        {expandDexList && moreProtocolAggs.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border/70 bg-background/50 p-2">
            <div className="flex flex-wrap gap-1.5">
              {moreProtocolAggs.map((agg) => (
                <button
                  key={agg.project}
                  type="button"
                  title={agg.project}
                  className={cn(
                    chipClass,
                    'max-w-[10rem] truncate text-left',
                    filters.protocols.includes(agg.project)
                      ? 'border-gold/70 bg-gold/15 text-gold'
                      : 'border-border bg-card hover:border-gold/35'
                  )}
                  onClick={() => toggleProtocol(agg.project)}
                >
                  {formatDexLabel(agg.project)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Barra de ferramentas */}
      <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={filters.sortBy}
          onValueChange={(value) => updateFilter('sortBy', value as PoolFilters['sortBy'])}
        >
          <SelectTrigger className="h-10 w-full border-border/80 bg-card/80 sm:w-[160px]">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apr">APR</SelectItem>
            <SelectItem value="tvl">TVL</SelectItem>
            <SelectItem value="volume">Volume 24h</SelectItem>
            <SelectItem value="change7d">Var. 7d</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          variant={filters.safeAprProfile ? 'default' : 'outline'}
          className={cn(
            'h-10 border-gold/40 bg-card/80',
            filters.safeAprProfile && 'bg-gold text-background hover:bg-gold/90'
          )}
          onClick={toggleSafeAprProfile}
        >
          Melhor APR · seguro
        </Button>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-full text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:w-auto sm:mr-1">
            TVL mín.
          </span>
          {TVL_PRESETS.map((p) => (
            <Button
              key={p.value}
              type="button"
              size="sm"
              variant={filters.tvlMin === p.value ? 'default' : 'outline'}
              className={cn(
                'h-9 rounded-lg text-xs',
                filters.tvlMin === p.value && 'bg-gold text-background hover:bg-gold/90'
              )}
              onClick={() => updateFilter('tvlMin', p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 gap-2 border-gold/35 bg-card/80"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Mais filtros
              {activeTotal > 0 && (
                <Badge className="bg-gold px-1.5 text-[10px] text-background">{activeTotal}</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
            <SheetHeader className="pb-2">
              <SheetTitle className="text-foreground">Filtros avançados</SheetTitle>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-5 pb-6">
              <div>
                <Label className="text-sm font-medium text-foreground">Ordenação inteligente</Label>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Pesa APR, TVL e risco para destacar linhas na tabela.
                </p>
                <div className="mt-3 space-y-3">
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <Checkbox
                      checked={filters.smartHighApr}
                      onCheckedChange={(v) => updateFilter('smartHighApr', v === true)}
                    />
                    <span className="text-sm text-foreground">Alta rentabilidade (APR alto)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <Checkbox
                      checked={filters.smartHighTvl}
                      onCheckedChange={(v) => updateFilter('smartHighTvl', v === true)}
                    />
                    <span className="text-sm text-foreground">Alta liquidez (TVL alto)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <Checkbox
                      checked={filters.smartLowRisk}
                      onCheckedChange={(v) => updateFilter('smartLowRisk', v === true)}
                    />
                    <span className="text-sm text-foreground">Baixo risco (blue chips)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <Checkbox
                      checked={filters.safeAprProfile}
                      onCheckedChange={(v) => {
                        const on = v === true
                        onFiltersChange({
                          ...filters,
                          safeAprProfile: on,
                          quickPreset: 'none',
                          ...(on ? { sortBy: 'apr', sortDirection: 'desc' } : {}),
                        })
                      }}
                    />
                    <span className="text-sm text-foreground">Perfil seguro (TVL / volume / redes)</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                {activeTotal > 0 && (
                  <p className="text-xs font-medium text-gold">
                    {activeTotal} filtro(s) ativo(s)
                  </p>
                )}
                <Button type="button" variant="outline" size="sm" className="border-gold/40" onClick={clearFilters}>
                  Limpar tudo
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Chips ativos */}
      {(filters.chains.length > 0 ||
        filters.protocols.length > 0 ||
        filters.safeAprProfile ||
        filters.smartHighApr ||
        filters.smartHighTvl ||
        filters.smartLowRisk ||
        filters.tvlMin !== DEFAULT_FILTERS.tvlMin) && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-background/40 px-2 py-2">
          <span className="text-[11px] font-medium text-muted-foreground">Ativos:</span>
          {filters.tvlMin !== DEFAULT_FILTERS.tvlMin && (
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
              TVL ≥ {filters.tvlMin >= 1e6 ? `${filters.tvlMin / 1e6}M` : `${filters.tvlMin / 1e3}K`}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('tvlMin', DEFAULT_FILTERS.tvlMin)} />
            </Badge>
          )}
          {filters.safeAprProfile && (
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
              APR · perfil seguro
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('safeAprProfile', false)} />
            </Badge>
          )}
          {filters.smartHighApr && (
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
              Smart: APR alto
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('smartHighApr', false)} />
            </Badge>
          )}
          {filters.smartHighTvl && (
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
              Smart: TVL alto
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('smartHighTvl', false)} />
            </Badge>
          )}
          {filters.smartLowRisk && (
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
              Smart: baixo risco
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('smartLowRisk', false)} />
            </Badge>
          )}
          {filters.chains.map((chain) => (
            <Badge key={chain} variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
              {chain}
              <X className="h-3 w-3 cursor-pointer" onClick={() => toggleChain(chain)} />
            </Badge>
          ))}
          {filters.protocols.map((protocol) => (
            <Badge
              key={protocol}
              variant="secondary"
              className="max-w-[200px] gap-1 break-all px-2 py-0.5 text-xs"
            >
              {formatDexLabel(protocol)}
              <X className="h-3 w-3 shrink-0 cursor-pointer" onClick={() => toggleProtocol(protocol)} />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
