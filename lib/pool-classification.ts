import type {
  AprPreset,
  ChainCategoryFilter,
  Pool,
  PoolFilters,
  PoolTypeFilter,
  QuickPreset,
  VolumePreset,
} from './types'

/** Redes consideradas consolidadas (volume/estabilidade). */
export const SAFE_CHAINS = new Set([
  'Ethereum',
  'Arbitrum',
  'Base',
  'Polygon',
  'Solana',
])

/** Hyperliquid e demais chains não listadas em SAFE → oportunidade / maior risco. */
export const PRIMARY_DEX_KEYWORDS = [
  'uniswap',
  'orca',
  'raydium',
  'meteora',
  'balancer',
] as const

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
  const c = getChainCategory(pool.chain)
  return category === 'safe' ? c === 'safe' : c === 'opportunity'
}

export function applyQuickPreset(preset: QuickPreset): Partial<PoolFilters> {
  switch (preset) {
    case 'yield':
      return {
        quickPreset: 'yield',
        chainCategory: 'all',
        primaryDexOnly: false,
        chains: [],
        protocols: [],
        sortBy: 'apr',
        sortDirection: 'desc',
        tvlMin: 10_000,
        aprPreset: 'all',
        aprMin: 0,
        aprMax: 1000,
        volumePreset: 'all',
        riskLevel: 'all',
        poolTypes: [],
        ilRisk: 'all',
        exposure: 'all',
        stablecoinOnly: false,
      }
    case 'safe':
      return {
        quickPreset: 'safe',
        chainCategory: 'safe',
        primaryDexOnly: false,
        chains: [],
        protocols: [],
        sortBy: 'tvl',
        sortDirection: 'desc',
        tvlMin: 100_000,
        aprPreset: 'all',
        aprMin: 0,
        aprMax: 1000,
        volumePreset: 'all',
        riskLevel: 'all',
        poolTypes: [],
        ilRisk: 'all',
        exposure: 'all',
        stablecoinOnly: false,
      }
    case 'balanced':
      return {
        quickPreset: 'balanced',
        chainCategory: 'all',
        primaryDexOnly: false,
        chains: [],
        protocols: [],
        sortBy: 'apr',
        sortDirection: 'desc',
        tvlMin: 100_000,
        aprPreset: 'all',
        aprMin: 0,
        aprMax: 1000,
        volumePreset: 'all',
        riskLevel: 'all',
        poolTypes: [],
        ilRisk: 'all',
        exposure: 'all',
        stablecoinOnly: false,
      }
    case 'volume':
      return {
        quickPreset: 'volume',
        chainCategory: 'safe',
        primaryDexOnly: false,
        chains: [],
        protocols: [],
        sortBy: 'volume',
        sortDirection: 'desc',
        tvlMin: 100_000,
        aprPreset: 'all',
        aprMin: 0,
        aprMax: 1000,
        volumePreset: 'high',
        riskLevel: 'all',
        poolTypes: [],
        ilRisk: 'all',
        exposure: 'all',
        stablecoinOnly: false,
      }
    default:
      return { quickPreset: 'none' }
  }
}

export function matchesVolumePreset(pool: Pool, preset: VolumePreset): boolean {
  if (preset === 'all') return true
  return getVolumeTier(pool.volumeUsd1d) === preset
}
