'use client'

import { useMemo } from 'react'
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
import { DEFAULT_FILTERS, type PoolFilters } from '@/lib/types'
import { isPrimaryDexProject } from '@/lib/pool-classification'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const TVL_PRESETS: { label: string; value: number }[] = [
  { label: '+10K', value: 10_000 },
  { label: '+100K', value: 100_000 },
  { label: '+1M', value: 1_000_000 },
  { label: '+10M', value: 10_000_000 },
]

/** Só para exibição; o valor do filtro continua a ser o slug da API. */
function formatDexLabel(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

interface PoolFiltersProps {
  filters: PoolFilters
  onFiltersChange: (filters: PoolFilters) => void
  chainOptions: string[]
  protocolOptions: string[]
}

export function PoolFiltersComponent({
  filters,
  onFiltersChange,
  chainOptions,
  protocolOptions,
}: PoolFiltersProps) {
  const updateFilter = <K extends keyof PoolFilters>(key: K, value: PoolFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value, quickPreset: 'none' })
  }

  const toggleChain = (chainId: string) => {
    const newChains = filters.chains.includes(chainId)
      ? filters.chains.filter((c) => c !== chainId)
      : [...filters.chains, chainId]
    onFiltersChange({ ...filters, chains: newChains, quickPreset: 'none' })
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

  const sortedProtocols = useMemo(() => {
    return [...protocolOptions].sort((a, b) => {
      const pa = isPrimaryDexProject(a)
      const pb = isPrimaryDexProject(b)
      if (pa !== pb) return pa ? -1 : 1
      return a.localeCompare(b)
    })
  }, [protocolOptions])

  const hasExtraFilters =
    filters.chains.length > 0 ||
    filters.protocols.length > 0 ||
    filters.tvlMin !== DEFAULT_FILTERS.tvlMin

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
      </div>

      <div className="rounded-xl border border-border bg-card/80 p-3">
        <Label className="text-sm font-medium text-foreground">Rede</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          Toque nas redes que quiser ver. Nenhuma selecionada = todas as redes na lista.
        </p>
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
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
          Corretoras descentralizadas (nomes da API). Toque para filtrar; nenhuma = todos.
        </p>
        <div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto pr-1">
          {sortedProtocols.length === 0 ? (
            <span className="text-xs text-muted-foreground">Carregando…</span>
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
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={clearFilters}>
            Limpar redes, DEX e TVL
          </Button>
        </div>
      )}

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
