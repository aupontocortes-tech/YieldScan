import { Pool, Protocol, PoolChartData, TokenPrice, SUPPORTED_CHAINS, SUPPORTED_PROTOCOLS } from './types'

const DEFILLAMA_YIELDS = 'https://yields.llama.fi'
const DEFILLAMA_API = 'https://api.llama.fi'
const COINS_API = 'https://coins.llama.fi'

function normProtocolId(s: string): string {
  return s.toLowerCase().replace(/-/g, '')
}

// Fetch all pools from DeFiLlama
export async function fetchPools(): Promise<Pool[]> {
  const response = await fetch(`${DEFILLAMA_YIELDS}/pools`)
  if (!response.ok) throw new Error('Failed to fetch pools')
  
  const data = await response.json()
  const pools: Pool[] = data.data
  
  // Filter by supported chains and protocols
  const supportedChainIds = SUPPORTED_CHAINS.map(c => c.id)
  
  return pools.filter(pool => 
    supportedChainIds.includes(pool.chain) &&
    SUPPORTED_PROTOCOLS.some(p => normProtocolId(pool.project).includes(normProtocolId(p)))
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

// Get APY color class based on value
export function getApyColorClass(apy: number): string {
  if (apy >= 20) return 'text-success'
  if (apy >= 5) return 'text-cyan'
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
  return chain?.color || '#6B7280'
}

// Get chain config
export function getChainConfig(chainId: string) {
  return SUPPORTED_CHAINS.find(c => c.id === chainId)
}

// Sort pools
export function sortPools(pools: Pool[], sortBy: string, direction: 'asc' | 'desc'): Pool[] {
  return [...pools].sort((a, b) => {
    let valueA: number
    let valueB: number
    
    switch (sortBy) {
      case 'apy':
        valueA = a.apy ?? 0
        valueB = b.apy ?? 0
        break
      case 'apy1d':
        valueA = a.apyBase1d ?? 0
        valueB = b.apyBase1d ?? 0
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
        valueA = a.apy ?? 0
        valueB = b.apy ?? 0
    }
    
    return direction === 'desc' ? valueB - valueA : valueA - valueB
  })
}

// Filter pools
export function filterPools(pools: Pool[], filters: {
  search?: string
  chains?: string[]
  protocols?: string[]
  aprMin?: number
  aprMax?: number
  tvlMin?: number
  ilRisk?: 'all' | 'no' | 'yes'
  exposure?: 'single' | 'multi' | 'all'
  stablecoinOnly?: boolean
}): Pool[] {
  return pools.filter(pool => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesSearch = 
        pool.symbol.toLowerCase().includes(searchLower) ||
        pool.project.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }
    
    // Chain filter
    if (filters.chains && filters.chains.length > 0) {
      if (!filters.chains.includes(pool.chain)) return false
    }
    
    // Protocol filter
    if (filters.protocols && filters.protocols.length > 0) {
      if (!filters.protocols.some(p => pool.project.toLowerCase().includes(p.toLowerCase()))) return false
    }
    
    // APR filter
    if (filters.aprMin !== undefined && pool.apy < filters.aprMin) return false
    if (filters.aprMax !== undefined && pool.apy > filters.aprMax) return false
    
    // TVL filter
    if (filters.tvlMin !== undefined && pool.tvlUsd < filters.tvlMin) return false
    
    // IL Risk filter
    if (filters.ilRisk && filters.ilRisk !== 'all') {
      if (pool.ilRisk !== filters.ilRisk) return false
    }
    
    // Exposure filter
    if (filters.exposure && filters.exposure !== 'all') {
      if (pool.exposure !== filters.exposure) return false
    }
    
    // Stablecoin filter
    if (filters.stablecoinOnly && !pool.stablecoin) return false
    
    return true
  })
}
