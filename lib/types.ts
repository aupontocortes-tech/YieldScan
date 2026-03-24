// Pool data from DeFiLlama API
export interface Pool {
  pool: string
  symbol: string
  project: string
  chain: string
  apy: number
  apyBase: number
  apyReward: number | null
  /** Base APR médio ~7d (DefiLlama). */
  apyBase7d: number | null
  apyMean30d: number | null
  /** Variacao % do APR em 24h (nao e o APR em si). */
  apyPct1D: number | null
  apyPct7D: number | null
  apyPct30D: number | null
  tvlUsd: number
  volumeUsd1d: number | null
  volumeUsd7d: number | null
  ilRisk: 'yes' | 'no'
  exposure: 'single' | 'multi'
  stablecoin: boolean
  rewardTokens: string[] | null
  url: string
  underlyingTokens: string[] | null
}

// Protocol data from DeFiLlama API
export interface Protocol {
  id: string
  name: string
  slug: string
  symbol: string
  tvl: number
  chainTvls: Record<string, number>
  chains: string[]
  logo: string
  url: string
  category: string
}

// Pool chart data
export interface PoolChartData {
  timestamp: string
  tvlUsd: number
  apy: number
  apyBase: number
  apyReward: number | null
}

// Token price data
export interface TokenPrice {
  price: number
  symbol: string
  timestamp: number
  confidence: number
}

// 1inch swap quote
export interface SwapQuote {
  dstAmount: string
  srcToken: string
  dstToken: string
  protocols: string[][][]
  gas: number
}

// Filters for pool table
export interface PoolFilters {
  search: string
  chains: string[]
  protocols: string[]
  aprMin: number
  aprMax: number
  tvlMin: number
  ilRisk: 'all' | 'no' | 'yes'
  exposure: 'single' | 'multi' | 'all'
  stablecoinOnly: boolean
  sortBy: 'apr' | 'apy1d' | 'apy7d' | 'apy30d' | 'tvl' | 'volume' | 'change7d'
  sortDirection: 'asc' | 'desc'
  period: 'current' | '1d' | '7d' | '30d'
}

export type PoolAprPeriod = PoolFilters['period']

// Chain configuration
export interface ChainConfig {
  id: string
  name: string
  color: string
  chainId?: number
}

// Supported chains
export const SUPPORTED_CHAINS: ChainConfig[] = [
  { id: 'Ethereum', name: 'Ethereum', color: '#627EEA', chainId: 1 },
  { id: 'Arbitrum', name: 'Arbitrum', color: '#28A0F0', chainId: 42161 },
  { id: 'Base', name: 'Base', color: '#0052FF', chainId: 8453 },
  { id: 'Optimism', name: 'Optimism', color: '#FF0420', chainId: 10 },
  { id: 'Polygon', name: 'Polygon', color: '#8247E5', chainId: 137 },
  { id: 'BSC', name: 'BSC', color: '#F0B90B', chainId: 56 },
  { id: 'Avalanche', name: 'Avalanche', color: '#E84142', chainId: 43114 },
  { id: 'Solana', name: 'Solana', color: '#14F195' },
  { id: 'Hyperliquid L1', name: 'Hyperliquid', color: '#00FFB7' },
]

// Supported protocols
export const SUPPORTED_PROTOCOLS = [
  'uniswap-v2',
  'uniswap-v3',
  'uniswap-v4',
  'curve-dex',
  'balancer-v2',
  'sushiswap',
  'pancakeswap-amm-v3',
  'velodrome-v2',
  'aerodrome-v1',
  'camelot-v3',
  'trader-joe-v2.1',
  'quickswap-v3',
  'raydium',
  'orca',
  'meteora',
  'jupiter',
  'hyperliquid',
  'drift',
  'phoenix',
  'lifinity',
  'kamino',
  'vertex',
  'kyberswap',
  'gmx-v2',
  'gmx-v2-synthetics',
  'dydx-v4',
  'paraswap',
  '1inch',
  'thruster',
  'ambient',
  'pangolin',
  'aave-v2',
  'aave-v3',
  'compound-v3',
  'morpho-aave',
  'venus',
  'spark',
]

// Default filters
export const DEFAULT_FILTERS: PoolFilters = {
  search: '',
  chains: [],
  protocols: [],
  aprMin: 0,
  aprMax: 1000,
  tvlMin: 0,
  ilRisk: 'all',
  exposure: 'all',
  stablecoinOnly: false,
  sortBy: 'apr',
  sortDirection: 'desc',
  period: 'current',
}

// Stats type
export interface GlobalStats {
  totalTvl: number
  totalPools: number
  totalProtocols: number
  avgApy: number
  maxApy: number
}
