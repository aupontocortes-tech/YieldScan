'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DEFAULT_FILTERS, type Pool, type PoolFilters } from '@/lib/types'
import { isPrimaryDexProject } from '@/lib/pool-classification'
import { canonicalLlamaChain } from '@/lib/llama-chain'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const TVL_PRESETS: { label: string; value: number }[] = [
  { label: '+10K', value: 10_000 },
  { label: '+100K', value: 100_000 },
  { label: '+1M', value: 1_000_000 },
  { label: '+10M', value: 10_000_000 },
]

function formatDexLabel(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function poolMatchesSelectedChains(pool: Pool, selectedChains: string[]): boolean {
  if (selectedChains.length === 0) return true
  const pc = canonicalLlamaChain(pool.chain)
  return selectedChains.some((c) => canonicalLlamaChain(c) === pc)
}

interface PoolFiltersProps {
  filters: PoolFilters
  onFiltersChange: (filters: PoolFilters) => void
  chainOptions: string[]
  /** Lista completa de pools (para listar só DEXs das redes escolhidas). */
  pools: Pool[]
}

export function PoolFiltersComponent({
  filters,
  onFiltersChange,
  chainOptions,
  pools,
}: PoolFiltersProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const updateFilter = <K extends keyof PoolFilters>(key: K, value: PoolFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value, quickPreset: 'none' })
  }

  const projectsOnSelectedChains = useMemo(() => {
    if (!pools.length) return []
    const subset = pools.filter((p) => poolMatchesSelectedChains(p, filters.chains))
    return [...new Set(subset.map((p) => p.project))]
  }, [pools, filters.chains])

  const sortedProtocols = useMemo(() => {
    return [...projectsOnSelectedChains].sort((a, b) => {
      const pa = isPrimaryDexProject(a)
      const pb = isPrimaryDexProject(b)
      if (pa !== pb) return pa ? -1 : 1
      return a.localeCompare(b)
    })
  }, [projectsOnSelectedChains])

  const pruneProtocols = (nextChains: string[]) => {
    const allowed = new Set(
      pools
        .filter((p) => poolMatchesSelectedChains(p, nextChains))
        .map((p) => p.project)
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
    onFiltersChange({ ...DEFAULT_FILTERS, search: filters.search })
  }

  const chainsSorted = useMemo(
    () => [...chainOptions].sort((a, b) => a.localeCompare(b)),
    [chainOptions]
  )

  const hasExtraFilters =
    filters.chains.length > 0 ||
    filters.protocols.length > 0 ||
    filters.tvlMin !== DEFAULT_FILTERS.tvlMin

  const activeFiltersCount = [
    filters.chains.length > 0,
    filters.protocols.length > 0,
    filters.tvlMin !== DEFAULT_FILTERS.tvlMin,
  ].filter(Boolean).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar token ou nome do protocolo…"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value, quickPreset: 'none' })}
            className="border-border bg-card pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={filters.sortBy}
            onValueChange={(value) => updateFilter('sortBy', value as PoolFilters['sortBy'])}
          >
            <SelectTrigger className="w-full border-border bg-card sm:w-[160px]">
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
              <Button type="button" variant="outline" className="gap-2 border-gold/40 bg-card">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-gold text-background">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
              <SheetHeader>
                <SheetTitle className="text-foreground">Rede e DEX</SheetTitle>
              </SheetHeader>

              <div className="mt-6 flex flex-1 flex-col gap-6 pb-6">
                <div className="rounded-xl border border-border bg-card/80 p-3">
                  <Label className="text-sm font-medium text-foreground">Rede</Label>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Nenhuma selecionada = todas. Ao escolher redes, a lista de DEX abaixo mostra só as corretoras
                    que têm pool nessas redes.
                  </p>
                  <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto pr-1">
                    {chainsSorted.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Carregando redes…</span>
                    ) : (
                      chainsSorted.map((chain) => (
                        <Badge
                          key={chain}
                          variant="outline"
                          className={cn(
                            'cursor-pointer transition-colors',
                            filters.chains.includes(chain)
                              ? 'border-gold bg-gold/15 text-gold'
                              : 'border-border hover:border-gold/50'
                          )}
                          onClick={() => toggleChain(chain)}
                        >
                          {chain}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card/80 p-3">
                  <Label className="text-sm font-medium text-foreground">DEX / protocolo</Label>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {filters.chains.length === 0
                      ? 'Mostrando todos os protocolos da lista. Selecione uma ou mais redes acima para encurtar esta lista.'
                      : `Só protocolos com pool em: ${filters.chains.join(', ')}.`}
                  </p>
                  <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
                    {sortedProtocols.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {filters.chains.length > 0
                          ? 'Nenhum protocolo nesta combinação de redes.'
                          : 'Carregando…'}
                      </span>
                    ) : (
                      sortedProtocols.map((project) => (
                        <Badge
                          key={project}
                          variant="outline"
                          title={project}
                          className={cn(
                            'max-w-[min(100%,14rem)] cursor-pointer break-words text-left',
                            isPrimaryDexProject(project) && 'border-gold/40',
                            filters.protocols.includes(project)
                              ? 'border-gold bg-gold/15 text-gold'
                              : 'border-border hover:border-gold/40'
                          )}
                          onClick={() => toggleProtocol(project)}
                        >
                          {formatDexLabel(project)}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card/80 p-3">
                  <Label className="text-sm font-medium text-foreground">TVL mínimo na pool</Label>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Recarrega a lista no servidor (menos ruído com valor mais alto).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TVL_PRESETS.map((p) => (
                      <Button
                        key={p.value}
                        type="button"
                        size="sm"
                        variant={filters.tvlMin === p.value ? 'default' : 'outline'}
                        className={cn(filters.tvlMin === p.value && 'bg-gold text-background hover:bg-gold/90')}
                        onClick={() => updateFilter('tvlMin', p.value)}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {hasExtraFilters && (
                  <Button type="button" variant="ghost" className="text-muted-foreground" onClick={clearFilters}>
                    Limpar redes, DEX e TVL
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {(filters.chains.length > 0 || filters.protocols.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Ativos:</span>
          {filters.chains.map((chain) => (
            <Badge key={chain} variant="secondary" className="gap-1 bg-secondary">
              {chain}
              <X className="h-3 w-3 cursor-pointer" onClick={() => toggleChain(chain)} />
            </Badge>
          ))}
          {filters.protocols.map((protocol) => (
            <Badge
              key={protocol}
              variant="secondary"
              className="max-w-[220px] gap-1 break-all bg-secondary"
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
