import type {
  AprPreset,
  ChainCategoryFilter,
  Pool,
  PoolFilters,
  PoolTypeFilter,
  QuickPreset,
  VolumePreset,
} from './types'

/** Redes muito líquidas / “blue chip” (filtro Mais seguro). */
export const SAFE_CHAINS = new Set([
  'Ethereum',
  'Arbitrum',
  'Optimism',
  'Base',
  'Polygon',
  'Solana',
  'BSC',
  'Avalanche',
])

/**
 * Famosas + hypadas + as que você citou (Uniswap-land, Solana, Hyperliquid, L2s em alta).
 * Filtro “Em foco” / preset Minhas redes — nomes iguais ao campo `chain` da DefiLlama.
 */
export const PREFERRED_CHAINS = new Set<string>([
  ...SAFE_CHAINS,
  'Hyperliquid L1',
  'Blast',
  'Linea',
  'Scroll',
  'zkSync Era',
  'Mantle',
  'Manta',
  'Mode',
  'Berachain',
  'Sonic',
  'Monad',
  'Sei',
  'Taiko',
])

/** DEXs / AMMs fortes para destaque e filtro “só principais”. */
export const PRIMARY_DEX_KEYWORDS = [
  'uniswap',
  'orca',
  'raydium',
  'meteora',
  'balancer',
  'jupiter',
  'drift',
  'curve',
  'aerodrome',
  'velodrome',
  'pancake',
  'sushi',
  'kamino',
  'gmx',
  'camelot',
  'trader-joe',
  'traderjoe',
  'quickswap',
  'osmosis',
  'vertex',
  'dydx',
] as const

export function isPreferredChain(chain: string): boolean {
  return PREFERRED_CHAINS.has(chain)
}

export function getChainCategory(chain: string): 'safe' | 'opportunity' {
  return SAFE_CHAINS.has(chain) ? 'safe' : 'opportunity'
}

export function isPrimaryDexProject(project: string): boolean {
  const p = project.toLowerCase()
  return PRIMARY_DEX_KEYWORDS.some((k) => p.includes(k))
}

export function getVolumeTier(volumeUsd1d: number | null | undefined): 'low' | 'medium' | 'high' {
  const v = volumeUsd1d ?? 0
  if (v < 50_000) return 'low'
  if (v < 500_000) return 'medium'
  return 'high'
}

export function inferPoolTypes(pool: Pool): PoolTypeFilter[] {
  const types = new Set<PoolTypeFilter>()
  if (pool.stablecoin) types.add('stable')
  else types.add('volatile')

  const meta = (pool.poolMeta ?? '').toLowerCase()
  const proj = pool.project.toLowerCase()
  if (
    meta.includes('%') ||
    proj.includes('univ3') ||
    proj.includes('uniswap-v3') ||
    proj.includes('uniswap-v4') ||
    proj.includes('meteora') ||
    proj.includes('dlmm') ||
    meta.includes('concentrated') ||
    meta.includes('clamm')
  ) {
    types.add('concentrated')
  }

  if ((pool.apyReward ?? 0) > 0 || (pool.rewardTokens?.length ?? 0) > 0) {
    types.add('farming')
  }

  const auto = ['beefy', 'yearn', 'convex', 'autocompound', 'auto-compound', 'aura', 'penpie', 'stake-dao']
  if (auto.some((a) => proj.includes(a))) types.add('autocompound')

  return [...types]
}

/** Risco heurístico: stable + rede segura + APR moderado = baixo; resto sobe com IL e APR. */
export function computePoolRiskLevel(pool: Pool, displayApr: number): 'low' | 'medium' | 'high' {
  const cat = getChainCategory(pool.chain)
  if (pool.stablecoin && cat === 'safe' && displayApr <= 25 && pool.ilRisk === 'no') return 'low'
  if (displayApr >= 100 || cat === 'opportunity') return 'high'
  if (displayApr >= 50 || pool.ilRisk === 'yes') return 'high'
  if (pool.stablecoin && displayApr <= 40) return 'medium'
  if (cat === 'safe') return 'medium'
  return 'high'
}

export function aprPresetBounds(preset: AprPreset): { min: number; max: number } | null {
  switch (preset) {
    case 'lte20':
      return { min: 0, max: 20 }
    case 'b20_50':
      return { min: 20, max: 50 }
    case 'b50_100':
      return { min: 50, max: 100 }
    case 'gt100':
      return { min: 100, max: 1_000_000 }
    default:
      return null
  }
}

export function shouldFlashHighApr(displayApr: number): boolean {
  return displayApr >= 50
}

export function shouldExtremeAprWarning(displayApr: number): boolean {
  return displayApr >= 100
}

export function passesChainCategory(pool: Pool, category: ChainCategoryFilter): boolean {
  if (category === 'all') return true
  if (category === 'focus') return PREFERRED_CHAINS.has(pool.chain)
  const c = getChainCategory(pool.chain)
  return category === 'safe' ? c === 'safe' : c === 'opportunity'
}

export function applyQuickPreset(preset: QuickPreset): Partial<PoolFilters> {
  const baseReset = {
    chains: [] as string[],
    protocols: [] as string[],
    aprPreset: 'all' as const,
    aprMin: 0,
    aprMax: 1000,
    volumePreset: 'all' as const,
    riskLevel: 'all' as const,
    poolTypes: [] as PoolTypeFilter[],
    ilRisk: 'all' as const,
    exposure: 'all' as const,
    stablecoinOnly: false,
    primaryDexOnly: false,
  }

  switch (preset) {
    case 'myNetworks':
      return {
        ...baseReset,
        quickPreset: 'myNetworks',
        chainCategory: 'focus',
        sortBy: 'apr',
        sortDirection: 'desc',
        tvlMin: 10_000,
      }
    case 'yield':
      return {
        ...baseReset,
        quickPreset: 'yield',
        chainCategory: 'all',
        sortBy: 'apr',
        sortDirection: 'desc',
        tvlMin: 10_000,
      }
    case 'safe':
      return {
        ...baseReset,
        quickPreset: 'safe',
        chainCategory: 'safe',
        sortBy: 'tvl',
        sortDirection: 'desc',
        tvlMin: 100_000,
      }
    case 'balanced':
      return {
        ...baseReset,
        quickPreset: 'balanced',
        chainCategory: 'focus',
        sortBy: 'apr',
        sortDirection: 'desc',
        tvlMin: 100_000,
      }
    case 'volume':
      return {
        ...baseReset,
        quickPreset: 'volume',
        chainCategory: 'safe',
        sortBy: 'volume',
        sortDirection: 'desc',
        tvlMin: 100_000,
        volumePreset: 'high',
      }
    default:
      return { quickPreset: 'none' }
  }
}

export function matchesVolumePreset(pool: Pool, preset: VolumePreset): boolean {
  if (preset === 'all') return true
  return getVolumeTier(pool.volumeUsd1d) === preset
}
