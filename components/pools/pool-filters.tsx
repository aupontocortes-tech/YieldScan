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
  'cursor-pointer border px-2 py-1 text-xs font-medium transition-colors rounded-md'

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
    (filters.search.trim() ? 1 : 0)

  const hasSheetExtras =
    filters.chains.length > 0 ||
    filters.protocols.length > 0 ||
    filters.tvlMin !== DEFAULT_FILTERS.tvlMin ||
    filters.smartHighApr ||
    filters.smartHighTvl ||
    filters.smartLowRisk

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar token ou protocolo…"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value, quickPreset: 'none' })}
            className="h-9 border-border bg-card pl-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.sortBy}
            onValueChange={(value) => updateFilter('sortBy', value as PoolFilters['sortBy'])}
          >
            <SelectTrigger className="h-9 w-full border-border bg-card sm:w-[150px]">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apr">APR</SelectItem>
              <SelectItem value="tvl">TVL</SelectItem>
              <SelectItem value="volume">Volume 24h</SelectItem>
              <SelectItem value="change7d">Var. 7d</SelectItem>
            </SelectContent>
          </Select>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5 border-gold/40 bg-card">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeTotal > 0 && (
                  <Badge className="bg-gold px-1.5 text-[10px] text-background">{activeTotal}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
              <SheetHeader className="pb-2">
                <SheetTitle className="text-foreground">Rede e DEX</SheetTitle>
              </SheetHeader>

              <div className="flex flex-1 flex-col gap-5 pb-6">
                <div>
                  <Label className="text-sm font-medium text-foreground">Redes principais</Label>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Máx. duas linhas. Nenhuma = todas. Use &quot;Mais redes&quot; para o restante.
                  </p>
                  <div className="mt-2.5 flex max-h-[4.5rem] flex-wrap gap-1.5 overflow-hidden">
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
                              ? 'border-gold bg-gold/15 text-gold'
                              : 'border-border bg-card text-foreground hover:border-gold/50'
                          )}
                          onClick={() => toggleChain(chain)}
                        >
                          {chain}
                        </button>
                      ))
                    )}
                  </div>
                  {extraChains.length > 0 && (
                    <Dialog open={moreChainsOpen} onOpenChange={setMoreChainsOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" className="mt-2 h-8 px-2 text-xs text-gold">
                          Mais redes
                        </Button>
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
                                  ? 'border-gold bg-gold/15 text-gold'
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

                <div className="border-t border-border pt-4">
                  <Label className="text-sm font-medium text-foreground">DEX em destaque</Label>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Principais por TVL, volume e APR médio nas redes selecionadas (ou em todas).
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
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
                            'max-w-[11rem] truncate text-left',
                            filters.protocols.includes(agg.project)
                              ? 'border-gold bg-gold/15 text-gold'
                              : 'border-border bg-card hover:border-gold/40'
                          )}
                          onClick={() => toggleProtocol(agg.project)}
                        >
                          {formatDexLabel(agg.project)}
                        </button>
                      ))
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="mt-1 h-auto p-0 text-xs text-gold"
                    onClick={() => setExpandDexList((e) => !e)}
                  >
                    {expandDexList ? 'Ver menos protocolos' : 'Ver mais protocolos'}
                  </Button>
                  {expandDexList && moreProtocolAggs.length > 0 && (
                    <div className="mt-2 max-h-48 flex flex-wrap gap-1.5 overflow-y-auto rounded-md border border-border/60 bg-background/50 p-2">
                      {moreProtocolAggs.map((agg) => (
                        <button
                          key={agg.project}
                          type="button"
                          title={agg.project}
                          className={cn(
                            chipClass,
                            'max-w-[10rem] truncate text-left',
                            filters.protocols.includes(agg.project)
                              ? 'border-gold bg-gold/15 text-gold'
                              : 'border-border bg-card hover:border-gold/35'
                          )}
                          onClick={() => toggleProtocol(agg.project)}
                        >
                          {formatDexLabel(agg.project)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <Label className="text-sm font-medium text-foreground">Filtro rápido (rentabilidade)</Label>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Ativos: reordenam a tabela e destacam linhas com melhor score composto.
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
                      <span className="text-sm text-foreground">Baixo risco (blue chips / estável)</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <Label className="text-sm font-medium text-foreground">TVL mínimo</Label>
                  <p className="mt-1 text-[11px] text-muted-foreground">Recarrega dados no servidor.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {TVL_PRESETS.map((p) => (
                      <Button
                        key={p.value}
                        type="button"
                        size="sm"
                        variant={filters.tvlMin === p.value ? 'default' : 'outline'}
                        className={cn(
                          'h-8 text-xs',
                          filters.tvlMin === p.value && 'bg-gold text-background hover:bg-gold/90'
                        )}
                        onClick={() => updateFilter('tvlMin', p.value)}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  {activeTotal > 0 && (
                    <p className="text-xs font-medium text-gold">{activeTotal} filtros ativos</p>
                  )}
                  {hasSheetExtras && (
                    <Button type="button" variant="outline" size="sm" className="border-gold/40" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {(filters.chains.length > 0 || filters.protocols.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Ativos:</span>
          {filters.chains.map((chain) => (
            <Badge key={chain} variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
              {chain}
              <X className="h-3 w-3 cursor-pointer" onClick={() => toggleChain(chain)} />
            </Badge>
          ))}
          {filters.protocols.map((protocol) => (
            <Badge key={protocol} variant="secondary" className="max-w-[200px] gap-1 break-all px-2 py-0.5 text-xs">
              {formatDexLabel(protocol)}
              <X className="h-3 w-3 shrink-0 cursor-pointer" onClick={() => toggleProtocol(protocol)} />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
