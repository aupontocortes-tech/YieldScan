'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
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
import {
  DEFAULT_FILTERS,
  type AprPreset,
  type ChainCategoryFilter,
  type PoolFilters,
  type PoolTypeFilter,
  type QuickPreset,
  type RiskLevelFilter,
  type VolumePreset,
} from '@/lib/types'
import {
  applyQuickPreset,
  isPrimaryDexProject,
  PREFERRED_CHAINS,
  SAFE_CHAINS,
  PRIMARY_DEX_KEYWORDS,
} from '@/lib/pool-classification'
import { Search, SlidersHorizontal, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const TVL_PRESETS: { label: string; value: number }[] = [
  { label: '+10K', value: 10_000 },
  { label: '+100K', value: 100_000 },
  { label: '+1M', value: 1_000_000 },
  { label: '+10M', value: 10_000_000 },
]

const APR_PRESETS: { id: AprPreset; label: string }[] = [
  { id: 'lte20', label: 'Até 20%' },
  { id: 'b20_50', label: '20% – 50%' },
  { id: 'b50_100', label: '50% – 100%' },
  { id: 'gt100', label: '+100%' },
]

const POOL_TYPE_OPTS: { id: PoolTypeFilter; label: string }[] = [
  { id: 'stable', label: 'Stable' },
  { id: 'volatile', label: 'Volátil' },
  { id: 'concentrated', label: 'Concentrada' },
  { id: 'farming', label: 'Farming' },
  { id: 'autocompound', label: 'Auto-compound' },
]

const QUICK: { id: QuickPreset; label: string; hint: string }[] = [
  {
    id: 'myNetworks',
    label: 'Minhas redes',
    hint: 'Foco nas redes famosas + hypadas que você usa (ETH, L2s, Solana, Hyperliquid, etc.).',
  },
  { id: 'yield', label: 'Maior rendimento', hint: 'Todas as chains da API; ordena por APR.' },
  { id: 'safe', label: 'Mais seguro', hint: 'Só redes blue-chip; TVL maior.' },
  { id: 'balanced', label: 'Equilibrado', hint: 'Lista em foco com TVL mínimo mais alto.' },
  { id: 'volume', label: 'Maior volume', hint: 'Redes blue-chip + volume 24h alto.' },
]

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
  const [isOpen, setIsOpen] = useState(false)

  const updateFilter = <K extends keyof PoolFilters>(key: K, value: PoolFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value, quickPreset: 'none' })
  }

  const setQuickPreset = (preset: QuickPreset) => {
    onFiltersChange({ ...filters, ...applyQuickPreset(preset) })
  }

  const toggleChain = (chainId: string) => {
    const newChains = filters.chains.includes(chainId)
      ? filters.chains.filter((c) => c !== chainId)
      : [...filters.chains, chainId]
    let chainCategory = filters.chainCategory
    if (chainCategory === 'focus' && newChains.some((c) => !PREFERRED_CHAINS.has(c))) {
      chainCategory = 'all'
    }
    onFiltersChange({ ...filters, chains: newChains, chainCategory, quickPreset: 'none' })
  }

  const toggleProtocol = (protocol: string) => {
    const newProtocols = filters.protocols.includes(protocol)
      ? filters.protocols.filter((p) => p !== protocol)
      : [...filters.protocols, protocol]
    onFiltersChange({ ...filters, protocols: newProtocols, quickPreset: 'none' })
  }

  const togglePoolType = (t: PoolTypeFilter) => {
    const next = filters.poolTypes.includes(t)
      ? filters.poolTypes.filter((x) => x !== t)
      : [...filters.poolTypes, t]
    onFiltersChange({ ...filters, poolTypes: next, quickPreset: 'none' })
  }

  const clearFilters = () => {
    onFiltersChange({ ...DEFAULT_FILTERS, search: filters.search })
  }

  const safeChains = useMemo(
    () => chainOptions.filter((c) => SAFE_CHAINS.has(c)),
    [chainOptions]
  )
  const focusChains = useMemo(
    () => chainOptions.filter((c) => PREFERRED_CHAINS.has(c)),
    [chainOptions]
  )
  const otherChains = useMemo(
    () => chainOptions.filter((c) => !PREFERRED_CHAINS.has(c)),
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

  const activeFiltersCount = [
    filters.chains.length > 0,
    filters.protocols.length > 0,
    filters.chainCategory !== 'all' && filters.chainCategory !== DEFAULT_FILTERS.chainCategory,
    filters.aprPreset !== 'all',
    filters.aprMin > 0,
    filters.aprMax < 1000,
    filters.tvlMin > DEFAULT_FILTERS.tvlMin,
    filters.volumePreset !== 'all',
    filters.riskLevel !== 'all',
    filters.poolTypes.length > 0,
    filters.primaryDexOnly,
    filters.ilRisk !== 'all',
    filters.exposure !== 'all',
    filters.stablecoinOnly,
    filters.quickPreset !== 'none',
  ].filter(Boolean).length

  const chainCategoryBtn = (value: ChainCategoryFilter, label: string) => (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn(
        'min-w-[5.5rem] flex-1 border-border text-xs',
        filters.chainCategory === value && 'border-gold bg-gold/15 text-gold'
      )}
      onClick={() => updateFilter('chainCategory', value)}
    >
      {label}
    </Button>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gold/25 bg-card/80 p-3">
        <p className="mb-2 text-xs font-medium text-gold">Filtros rápidos</p>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <Button
              key={q.id}
              type="button"
              size="sm"
              variant={filters.quickPreset === q.id ? 'default' : 'outline'}
              title={q.hint}
              className={cn(
                'gap-1 border-gold/40 text-xs',
                filters.quickPreset === q.id && 'bg-gold text-background hover:bg-gold/90'
              )}
              onClick={() => setQuickPreset(q.id)}
            >
              {q.label}
              <Info className="h-3 w-3 opacity-70" />
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por token ou protocolo..."
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
            <SelectTrigger className="w-[150px] border-border bg-card">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apr">APR</SelectItem>
              <SelectItem value="tvl">TVL</SelectItem>
              <SelectItem value="volume">Volume 24h</SelectItem>
              <SelectItem value="change7d">Var. 7d</SelectItem>
            </SelectContent>
          </Select>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 border-gold/40 bg-card">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-gold text-background">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between text-foreground">
                  Filtros avançados
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Limpar tudo
                    </Button>
                  )}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-8">
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gold">DEX principais (prioridade)</Label>
                  <p className="text-xs text-muted-foreground">
                    {PRIMARY_DEX_KEYWORDS.join(', ')} — destaque na lista e opção para filtrar só estes.
                  </p>
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span className="text-sm">Apenas DEX principais</span>
                    <Switch
                      checked={filters.primaryDexOnly}
                      onCheckedChange={(checked) => updateFilter('primaryDexOnly', checked)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gold">Redes (classificação)</Label>
                  <div className="flex flex-wrap gap-2">
                    {chainCategoryBtn('focus', 'Em foco')}
                    {chainCategoryBtn('all', 'Todas')}
                    {chainCategoryBtn('safe', 'Blue chip')}
                    {chainCategoryBtn('opportunity', 'Oportunidade')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Em foco</strong>: redes famosas + hypadas (ETH, grandes L2s,
                    Solana, BSC, Avax, Hyperliquid, Blast, Linea, Scroll, zkSync, Mantle, Monad, etc.).{' '}
                    <strong className="text-foreground">Blue chip</strong>: ETH, Arbitrum, OP, Base, Polygon,
                    Solana, BSC, Avalanche. Use <strong className="text-foreground">Todas</strong> para qualquer
                    chain que a API listar.
                  </p>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Lista em foco (atalhos)
                    </p>
                    <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
                      {focusChains.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        focusChains.map((chain) => (
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

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Blue chip (filtro Seguras)
                    </p>
                    <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
                      {safeChains.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        safeChains.map((chain) => (
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

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Outras redes na API
                    </p>
                    <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
                      {otherChains.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        otherChains.map((chain) => (
                          <Badge
                            key={chain}
                            variant="outline"
                            className={cn(
                              'cursor-pointer transition-colors',
                              filters.chains.includes(chain)
                                ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
                                : 'border-border hover:border-amber-500/40'
                            )}
                            onClick={() => toggleChain(chain)}
                          >
                            {chain}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gold">Rentabilidade (APR)</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={filters.aprPreset === 'all' ? 'default' : 'outline'}
                      className={cn(filters.aprPreset === 'all' && 'bg-gold text-background')}
                      onClick={() => updateFilter('aprPreset', 'all')}
                    >
                      Todas faixas
                    </Button>
                    {APR_PRESETS.map((p) => (
                      <Button
                        key={p.id}
                        type="button"
                        size="sm"
                        variant={filters.aprPreset === p.id ? 'default' : 'outline'}
                        className={cn(
                          p.id === 'gt100' && filters.aprPreset === p.id && 'bg-destructive text-destructive-foreground',
                          p.id !== 'gt100' && filters.aprPreset === p.id && 'bg-gold text-background'
                        )}
                        onClick={() => updateFilter('aprPreset', p.id)}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                  {filters.aprPreset === 'all' && (
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Ajuste fino</span>
                        <span>
                          {filters.aprMin}% – {filters.aprMax}%
                        </span>
                      </div>
                      <Slider
                        value={[filters.aprMin, filters.aprMax]}
                        min={0}
                        max={1000}
                        step={1}
                        onValueChange={([min, max]) =>
                          onFiltersChange({
                            ...filters,
                            aprMin: min,
                            aprMax: max,
                            quickPreset: 'none',
                          })
                        }
                        className="w-full"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gold">Risco (heurístico)</Label>
                  <Select
                    value={filters.riskLevel}
                    onValueChange={(value) => updateFilter('riskLevel', value as RiskLevelFilter)}
                  >
                    <SelectTrigger className="border-border bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="low">Baixo (ex.: stable em rede segura)</SelectItem>
                      <SelectItem value="medium">Médio</SelectItem>
                      <SelectItem value="high">Alto (volátil / novas redes)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gold">TVL mínimo (confiança)</Label>
                  <div className="flex flex-wrap gap-2">
                    {TVL_PRESETS.map((p) => (
                      <Button
                        key={p.value}
                        type="button"
                        size="sm"
                        variant={filters.tvlMin === p.value ? 'default' : 'outline'}
                        className={cn(filters.tvlMin === p.value && 'bg-gold text-background')}
                        onClick={() => updateFilter('tvlMin', p.value)}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    TVL maior costuma indicar liquidez mais profunda (não é garantia).
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gold">Volume 24h (taxas)</Label>
                  <p className="text-xs text-muted-foreground">
                    Volume alto costuma gerar mais taxas de swap para LPs (depende do protocolo e da sua
                    faixa).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['all', 'Todos'],
                        ['low', 'Baixo'],
                        ['medium', 'Médio'],
                        ['high', 'Alto'],
                      ] as const
                    ).map(([id, label]) => (
                      <Button
                        key={id}
                        type="button"
                        size="sm"
                        variant={filters.volumePreset === id ? 'default' : 'outline'}
                        className={cn(filters.volumePreset === id && 'bg-gold text-background')}
                        onClick={() => updateFilter('volumePreset', id as VolumePreset)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gold">Tipo de pool</Label>
                  <div className="flex flex-wrap gap-2">
                    {POOL_TYPE_OPTS.map((p) => (
                      <Badge
                        key={p.id}
                        variant="outline"
                        className={cn(
                          'cursor-pointer',
                          filters.poolTypes.includes(p.id)
                            ? 'border-gold bg-gold/15 text-gold'
                            : 'border-border'
                        )}
                        onClick={() => togglePoolType(p.id)}
                      >
                        {p.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground">Protocolos (API)</Label>
                  <div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto pr-1">
                    {sortedProtocols.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Carregando…</span>
                    ) : (
                      sortedProtocols.map((project) => (
                        <Badge
                          key={project}
                          variant="outline"
                          className={cn(
                            'max-w-full cursor-pointer break-all text-left',
                            isPrimaryDexProject(project) && 'border-gold/50 text-gold',
                            filters.protocols.includes(project)
                              ? 'border-gold bg-gold/15 text-gold'
                              : 'border-border'
                          )}
                          onClick={() => toggleProtocol(project)}
                        >
                          {project}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Risco de IL</Label>
                  <Select
                    value={filters.ilRisk}
                    onValueChange={(value) => updateFilter('ilRisk', value as PoolFilters['ilRisk'])}
                  >
                    <SelectTrigger className="border-border bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="no">Sem IL</SelectItem>
                      <SelectItem value="yes">Com IL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Exposição</Label>
                  <Select
                    value={filters.exposure}
                    onValueChange={(value) => updateFilter('exposure', value as PoolFilters['exposure'])}
                  >
                    <SelectTrigger className="border-border bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="single">Single asset</SelectItem>
                      <SelectItem value="multi">Multi asset</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="stablecoin" className="text-sm font-medium">
                    Apenas stablecoins
                  </Label>
                  <Switch
                    id="stablecoin"
                    checked={filters.stablecoinOnly}
                    onCheckedChange={(checked) => updateFilter('stablecoinOnly', checked)}
                  />
                </div>
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
              {protocol}
              <X className="h-3 w-3 shrink-0 cursor-pointer" onClick={() => toggleProtocol(protocol)} />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
