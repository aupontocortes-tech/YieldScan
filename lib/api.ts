import {
  Pool,
  PoolAprPeriod,
  Protocol,
  PoolChartData,
  TokenPrice,
  SUPPORTED_CHAINS,
  PoolFilters,
} from './types'
import {
  aprPresetBounds,
  computePoolRiskLevel,
  inferPoolTypes,
  isPrimaryDexProject,
  matchesVolumePreset,
  passesChainCategory,
} from './pool-classification'

const DEFILLAMA_YIELDS = 'https://yields.llama.fi'
const DEFILLAMA_API = 'https://api.llama.fi'
const COINS_API = 'https://coins.llama.fi'

// Fetch pools from DeFiLlama (todas as chains retornadas pela API; filtro mínimo de qualidade)
export async function fetchPools(): Promise<Pool[]> {
  const response = await fetch(`${DEFILLAMA_YIELDS}/pools`)
  if (!response.ok) throw new Error('Failed to fetch pools')
  
  const data = await response.json()
  const pools: Pool[] = data.data

  return pools.filter(
    (pool) =>
      pool.tvlUsd > 10_000 &&
      pool.apy !== null &&
      pool.apy !== undefined
  )
}

// Fetch pool chart data
export async function fetchPoolChart(poolId: string): Promise<PoolChartData[]> {
  const response = await fetch(`${DEFILLAMA_YIELDS}/chart/${poolId}`)
  if (!response.ok) throw new Error('Failed to fetch pool chart')
  
  const data = await response.json()
  return data.data
}

// Fetch all protocols
export async function fetchProtocols(): Promise<Protocol[]> {
  const response = await fetch(`${DEFILLAMA_API}/protocols`)
  if (!response.ok) throw new Error('Failed to fetch protocols')
  
  return response.json()
}

// Fetch token prices
export async function fetchTokenPrices(tokens: string[]): Promise<Record<string, TokenPrice>> {
  if (tokens.length === 0) return {}
  
  const tokenString = tokens.join(',')
  const response = await fetch(`${COINS_API}/prices/current/${tokenString}`)
  if (!response.ok) throw new Error('Failed to fetch token prices')
  
  const data = await response.json()
  return data.coins
}

// Fetch historical TVL by chain
export async function fetchHistoricalTvl(chain: string): Promise<{ date: number; tvl: number }[]> {
  const response = await fetch(`${DEFILLAMA_API}/v2/historicalChainTvl/${chain}`)
  if (!response.ok) throw new Error('Failed to fetch historical TVL')
  
  return response.json()
}

// Fetch TVL for all chains
export async function fetchAllChainsTvl(): Promise<Record<string, number>> {
  const response = await fetch(`${DEFILLAMA_API}/v2/chains`)
  if (!response.ok) throw new Error('Failed to fetch chains TVL')
  
  const data = await response.json()
  const tvlByChain: Record<string, number> = {}
  
  const supportedChainIds = SUPPORTED_CHAINS.map(c => c.id)
  
  for (const chain of data) {
    if (supportedChainIds.includes(chain.name)) {
      tvlByChain[chain.name] = chain.tvl
    }
  }
  
  return tvlByChain
}

// Format currency
export function formatCurrency(value: number, compact = true): string {
  if (compact) {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Format percentage
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `${value.toFixed(2)}%`
}

// Format number
export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Cor da taxa exibida (valor vem como `apy` na API DefiLlama; UI mostra como APR de pool.) */
export function getAprColorClass(rate: number): string {
  if (rate >= 100) return 'text-destructive'
  if (rate >= 50) return 'text-gold'
  if (rate >= 20) return 'text-[#fcd34d]'
  if (rate >= 5) return 'text-foreground'
  return 'text-muted-foreground'
}

// Get change indicator
export function getChangeIndicator(change: number | null): { text: string; color: string } {
  if (change === null || change === undefined) {
    return { text: '-', color: 'text-muted-foreground' }
  }
  if (change > 0) {
    return { text: `+${change.toFixed(2)}%`, color: 'text-success' }
  }
  if (change < 0) {
    return { text: `${change.toFixed(2)}%`, color: 'text-destructive' }
  }
  return { text: '0.00%', color: 'text-muted-foreground' }
}

// Get chain color
export function getChainColor(chainId: string): string {
  const chain = SUPPORTED_CHAINS.find(c => c.id === chainId)
  if (chain) return chain.color
  let h = 0
  for (let i = 0; i < chainId.length; i++) {
    h = chainId.charCodeAt(i) + ((h << 5) - h)
  }
  const hue = Math.abs(h) % 360
  return `hsl(${hue}, 50%, 58%)`
}

// Get chain config
export function getChainConfig(chainId: string) {
  return SUPPORTED_CHAINS.find(c => c.id === chainId)
}

/** APR mostrado na tabela conforme o separador (campos DefiLlama). */
export function poolDisplayApr(pool: Pool, period: PoolAprPeriod): number {
  switch (period) {
    case 'current':
    case '1d':
      return pool.apy
    case '7d':
      return pool.apyBase7d ?? pool.apy
    case '30d':
      return pool.apyMean30d ?? pool.apy
    default:
      return pool.apy
  }
}

export function poolHasAprDataForPeriod(pool: Pool, period: PoolAprPeriod): boolean {
  switch (period) {
    case 'current':
      return true
    case '1d':
      return pool.apyPct1D != null
    case '7d':
      return pool.apyBase7d != null || pool.apyPct7D != null
    case '30d':
      return pool.apyMean30d != null
    default:
      return true
  }
}

// Sort pools
export function sortPools(
  pools: Pool[],
  sortBy: string,
  direction: 'asc' | 'desc',
  period: PoolAprPeriod = 'current'
): Pool[] {
  return [...pools].sort((a, b) => {
    let valueA: number
    let valueB: number
    
    switch (sortBy) {
      case 'apr':
        valueA = poolDisplayApr(a, period)
        valueB = poolDisplayApr(b, period)
        break
      case 'apy1d':
        valueA = a.apyPct1D ?? 0
        valueB = b.apyPct1D ?? 0
        break
      case 'apy7d':
        valueA = a.apyPct7D ?? 0
        valueB = b.apyPct7D ?? 0
        break
      case 'apy30d':
        valueA = a.apyMean30d ?? 0
        valueB = b.apyMean30d ?? 0
        break
      case 'tvl':
        valueA = a.tvlUsd ?? 0
        valueB = b.tvlUsd ?? 0
        break
      case 'volume':
        valueA = a.volumeUsd1d ?? 0
        valueB = b.volumeUsd1d ?? 0
        break
      case 'change7d':
        valueA = a.apyPct7D ?? 0
        valueB = b.apyPct7D ?? 0
        break
      default:
        valueA = poolDisplayApr(a, period)
        valueB = poolDisplayApr(b, period)
    }
    
    return direction === 'desc' ? valueB - valueA : valueA - valueB
  })
}

// Filter pools
export function filterPools(
  pools: Pool[],
  filters: PoolFilters,
  period: PoolAprPeriod = 'current'
): Pool[] {
  const selectedProtocols = filters.protocols.length ? new Set(filters.protocols) : null

  return pools.filter((pool) => {
    if (period !== 'current' && !poolHasAprDataForPeriod(pool, period)) return false

    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesSearch =
        pool.symbol.toLowerCase().includes(searchLower) ||
        pool.project.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }

    if (!passesChainCategory(pool, filters.chainCategory)) return false

    if (filters.chains.length > 0 && !filters.chains.includes(pool.chain)) return false

    if (selectedProtocols && !selectedProtocols.has(pool.project)) return false

    if (filters.primaryDexOnly && !isPrimaryDexProject(pool.project)) return false

    const displayApr = poolDisplayApr(pool, period)
    const presetBounds = aprPresetBounds(filters.aprPreset)
    const aprLo = presetBounds?.min ?? filters.aprMin
    const aprHi = presetBounds?.max ?? filters.aprMax
    if (displayApr < aprLo || displayApr > aprHi) return false

    if (filters.riskLevel !== 'all') {
      if (computePoolRiskLevel(pool, displayApr) !== filters.riskLevel) return false
    }

    if (!matchesVolumePreset(pool, filters.volumePreset)) return false

    if (filters.poolTypes.length > 0) {
      const types = inferPoolTypes(pool)
      if (!filters.poolTypes.some((t) => types.includes(t))) return false
    }

    if (pool.tvlUsd < filters.tvlMin) return false

    if (filters.ilRisk !== 'all' && pool.ilRisk !== filters.ilRisk) return false

    if (filters.exposure !== 'all' && pool.exposure !== filters.exposure) return false

    if (filters.stablecoinOnly && !pool.stablecoin) return false

    return true
  })
}
