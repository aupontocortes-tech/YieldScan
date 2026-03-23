'use client'

import { useState } from 'react'
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
import { PoolFilters, SUPPORTED_CHAINS, DEFAULT_FILTERS } from '@/lib/types'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PoolFiltersProps {
  filters: PoolFilters
  onFiltersChange: (filters: PoolFilters) => void
}

const PROTOCOL_OPTIONS = [
  { value: 'uniswap', label: 'Uniswap' },
  { value: 'curve', label: 'Curve' },
  { value: 'balancer', label: 'Balancer' },
  { value: 'sushiswap', label: 'SushiSwap' },
  { value: 'pancakeswap', label: 'PancakeSwap' },
  { value: 'velodrome', label: 'Velodrome' },
  { value: 'aerodrome', label: 'Aerodrome' },
  { value: 'aave', label: 'Aave' },
  { value: 'compound', label: 'Compound' },
  { value: 'morpho', label: 'Morpho' },
  { value: 'raydium', label: 'Raydium' },
  { value: 'orca', label: 'Orca' },
]

export function PoolFiltersComponent({ filters, onFiltersChange }: PoolFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)

  const updateFilter = <K extends keyof PoolFilters>(key: K, value: PoolFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const toggleChain = (chainId: string) => {
    const newChains = filters.chains.includes(chainId)
      ? filters.chains.filter(c => c !== chainId)
      : [...filters.chains, chainId]
    updateFilter('chains', newChains)
  }

  const toggleProtocol = (protocol: string) => {
    const newProtocols = filters.protocols.includes(protocol)
      ? filters.protocols.filter(p => p !== protocol)
      : [...filters.protocols, protocol]
    updateFilter('protocols', newProtocols)
  }

  const clearFilters = () => {
    onFiltersChange(DEFAULT_FILTERS)
  }

  const activeFiltersCount = [
    filters.chains.length > 0,
    filters.protocols.length > 0,
    filters.aprMin > 0,
    filters.aprMax < 1000,
    filters.tvlMin > 0,
    filters.ilRisk !== 'all',
    filters.exposure !== 'all',
    filters.stablecoinOnly,
  ].filter(Boolean).length

  return (
    <div className="flex flex-col gap-4">
      {/* Search and Filter Button Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por token ou protocolo..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Select
            value={filters.sortBy}
            onValueChange={(value) => updateFilter('sortBy', value as PoolFilters['sortBy'])}
          >
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apy">APY</SelectItem>
              <SelectItem value="tvl">TVL</SelectItem>
              <SelectItem value="volume">Volume 24h</SelectItem>
              <SelectItem value="change7d">Var. 7d</SelectItem>
            </SelectContent>
          </Select>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 bg-card border-border">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-cyan text-background">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between">
                  Filtros Avancados
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Limpar tudo
                    </Button>
                  )}
                </SheetTitle>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {/* Chains */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Chains</Label>
                  <div className="flex flex-wrap gap-2">
                    {SUPPORTED_CHAINS.map((chain) => (
                      <Badge
                        key={chain.id}
                        variant="outline"
                        className={cn(
                          'cursor-pointer transition-colors',
                          filters.chains.includes(chain.id)
                            ? 'border-cyan bg-cyan/10 text-cyan'
                            : 'border-border hover:border-muted-foreground'
                        )}
                        onClick={() => toggleChain(chain.id)}
                      >
                        {chain.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Protocols */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Protocolos</Label>
                  <div className="flex flex-wrap gap-2">
                    {PROTOCOL_OPTIONS.map((protocol) => (
                      <Badge
                        key={protocol.value}
                        variant="outline"
                        className={cn(
                          'cursor-pointer transition-colors',
                          filters.protocols.includes(protocol.value)
                            ? 'border-cyan bg-cyan/10 text-cyan'
                            : 'border-border hover:border-muted-foreground'
                        )}
                        onClick={() => toggleProtocol(protocol.value)}
                      >
                        {protocol.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* APR Range */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">APY Range</Label>
                    <span className="text-xs text-muted-foreground">
                      {filters.aprMin}% - {filters.aprMax}%
                    </span>
                  </div>
                  <div className="pt-2">
                    <Slider
                      value={[filters.aprMin, filters.aprMax]}
                      min={0}
                      max={1000}
                      step={1}
                      onValueChange={([min, max]) => {
                        updateFilter('aprMin', min)
                        updateFilter('aprMax', max)
                      }}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* TVL Minimum */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">TVL Minimo</Label>
                    <span className="text-xs text-muted-foreground">
                      ${filters.tvlMin.toLocaleString()}
                    </span>
                  </div>
                  <div className="pt-2">
                    <Slider
                      value={[filters.tvlMin]}
                      min={0}
                      max={10000000}
                      step={10000}
                      onValueChange={([value]) => updateFilter('tvlMin', value)}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* IL Risk */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Risco de IL</Label>
                  <Select
                    value={filters.ilRisk}
                    onValueChange={(value) => updateFilter('ilRisk', value as PoolFilters['ilRisk'])}
                  >
                    <SelectTrigger className="bg-card border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="no">Sem risco de IL</SelectItem>
                      <SelectItem value="yes">Com risco de IL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Exposure */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Exposicao</Label>
                  <Select
                    value={filters.exposure}
                    onValueChange={(value) => updateFilter('exposure', value as PoolFilters['exposure'])}
                  >
                    <SelectTrigger className="bg-card border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="single">Single Asset</SelectItem>
                      <SelectItem value="multi">Multi Asset</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Stablecoin Only */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="stablecoin" className="text-sm font-medium">
                    Apenas Stablecoins
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

      {/* Active Filters Display */}
      {(filters.chains.length > 0 || filters.protocols.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtros ativos:</span>
          {filters.chains.map((chain) => (
            <Badge
              key={chain}
              variant="secondary"
              className="gap-1 bg-secondary"
            >
              {chain}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => toggleChain(chain)}
              />
            </Badge>
          ))}
          {filters.protocols.map((protocol) => (
            <Badge
              key={protocol}
              variant="secondary"
              className="gap-1 bg-secondary"
            >
              {PROTOCOL_OPTIONS.find(p => p.value === protocol)?.label ?? protocol}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => toggleProtocol(protocol)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
