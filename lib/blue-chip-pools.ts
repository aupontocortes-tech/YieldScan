import type { Pool } from './types'
import { canonicalLlamaChain } from './llama-chain'

/**
 * Foco do utilizador: Solana como rede principal + Ethereum.
 * Base retirada — concentra “corretoras” (DEX) líderes nessas duas chains.
 */
export const BLUE_CHIP_CHAINS = ['Solana', 'Ethereum'] as const

/** DEXs consideradas para pools Blue Chip em Solana (Raydium, Orca, Meteora…). */
export const SOLANA_BLUE_CHIP_DEX_KEYWORDS = [
  'raydium',
  'orca',
  'meteora',
  'lifinity',
  'phoenix',
] as const

/** DEXs AMM / liquidez “tier 1” em Ethereum. */
export const ETHEREUM_BLUE_CHIP_DEX_KEYWORDS = [
  'uniswap',
  'curve',
  'balancer',
  'sushi',
] as const

/** Lista única para filtros na UI (slug → valor do select). */
export const BLUE_CHIP_DEX_UI_SLUGS = [
  ...SOLANA_BLUE_CHIP_DEX_KEYWORDS,
  ...ETHEREUM_BLUE_CHIP_DEX_KEYWORDS,
] as const

/** @deprecated Use SOLANA_/ETHEREUM_ lists; mantido para imports antigos. */
export const BLUE_CHIP_DEX_KEYWORDS = BLUE_CHIP_DEX_UI_SLUGS

function isAllowedBlueChipDex(chain: string, project: string): boolean {
  const p = (project ?? '').toLowerCase()
  if (chain === 'Solana') {
    return SOLANA_BLUE_CHIP_DEX_KEYWORDS.some((k) => p.includes(k))
  }
  if (chain === 'Ethereum') {
    return ETHEREUM_BLUE_CHIP_DEX_KEYWORDS.some((k) => p.includes(k))
  }
  return false
}

/** Mapeia `project` DefiLlama para um slug do menu DEX (primeiro match). */
export function blueChipDexSlug(pool: Pick<Pool, 'project'>): (typeof BLUE_CHIP_DEX_UI_SLUGS)[number] | 'other' {
  const p = (pool.project ?? '').toLowerCase()
  for (const k of BLUE_CHIP_DEX_UI_SLUGS) {
    if (p.includes(k)) return k
  }
  return 'other'
}

/**
 * Tickers “blue chip” (alinhado a apps tipo “Top Pools” + blue-chip):
 * stables, BTC wraps, ETH/SOL, ouro, RWA/ETF, e large-caps DeFi frequentes em pools líquidas.
 */
const TOKEN_ALIAS: Record<string, string[]> = {
  BTC: ['BTC'],
  WBTC: ['WBTC'],
  CBBTC: ['CBBTC'],
  ETH: ['ETH'],
  WETH: ['WETH', 'STETH', 'WSTETH'],
  SOL: ['SOL', 'WSOL', 'MSOL', 'JITOSOL'],
  USDC: ['USDC', 'USDC.E', 'USDCE'],
  USDT: ['USDT'],
  DAI: ['DAI'],
  PYUSD: ['PYUSD'],
  USDS: ['USDS'],
  EUROC: ['EUROC'],
  EURC: ['EURC'],
  XAUT: ['XAUT', 'PAXG', 'XAU', 'GOLD'],
  SP500: ['SP500', 'S&P500', 'SPX'],
  SPY: ['SPY'],
  VOO: ['VOO'],
  QQQ: ['QQQ'],
  NVDA: ['NVDA'],
  USO: ['USO'],
  WTI: ['WTI'],
  BRENT: ['BRENT'],
  PENDLE: ['PENDLE'],
  ONDO: ['ONDO'],
  UNI: ['UNI'],
}

const BLUE_CHIP_TARGET_KEYS = Object.keys(TOKEN_ALIAS) as (keyof typeof TOKEN_ALIAS)[]
const STABLES = new Set(['USDC', 'USDT', 'DAI', 'PYUSD', 'USDS', 'EUROC', 'EURC'])

const MEME_BLACKLIST = new Set([
  'DOGE',
  'SHIB',
  'PEPE',
  'FLOKI',
  'BONK',
  'WIF',
  'MEME',
  'BOME',
  'MEW',
  'POPCAT',
])

/**
 * TVL mínimo baixo (tipo dashboards “Blue-chip” que ainda mostram pools ~5–10k).
 * O explorador já vem com minTvl da query; isto só corta pó anómalo.
 */
const MIN_BLUE_CHIP_TVL_USD = 5_000

function normalizeToken(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function extractSymbolTokens(symbol: string): string[] {
  return symbol
    .split(/[/\-_|:\s]+/)
    .map((t) => normalizeToken(t))
    .filter(Boolean)
}

/** Todos os tickers normalizados (par + underlying, únicos). */
export function poolTokenTickers(pool: Pool): string[] {
  const fromSymbol = extractSymbolTokens(pool.symbol ?? '')
  const merged = new Set(fromSymbol)
  for (const t of pool.underlyingTokens ?? []) {
    const n = normalizeToken(t)
    if (n) merged.add(n)
  }
  return [...merged]
}

function tokenMatchesBlueChipKey(token: string, key: keyof typeof TOKEN_ALIAS): boolean {
  const aliases = TOKEN_ALIAS[key].map((x) => normalizeToken(x))
  return aliases.includes(token)
}

/** Lista de chaves blue chip presentes na pool (ex.: ETH, USDC). */
export function poolBlueChipMatches(pool: Pool): string[] {
  const tokens = poolTokenTickers(pool)
  return BLUE_CHIP_TARGET_KEYS.filter((key) => tokens.some((tok) => tokenMatchesBlueChipKey(tok, key)))
}

/** Pelo menos 2 ativos da lista blue chip (ex.: USDC+SOL, BTC+ETH, SPY+USDC). */
export function isBlueChipPool(pool: Pool): boolean {
  const chain = canonicalLlamaChain(pool.chain)
  if (!BLUE_CHIP_CHAINS.includes(chain as (typeof BLUE_CHIP_CHAINS)[number])) return false
  if (!isAllowedBlueChipDex(chain, pool.project ?? '')) return false
  return poolBlueChipMatches(pool).length >= 2
}

export function hasGoodLiquidity(pool: Pool): boolean {
  return typeof pool.tvlUsd === 'number' && Number.isFinite(pool.tvlUsd) && pool.tvlUsd >= MIN_BLUE_CHIP_TVL_USD
}

export function isNotBlacklistedPool(pool: Pool): boolean {
  const tokens = poolTokenTickers(pool)
  return !tokens.some((t) => MEME_BLACKLIST.has(t))
}

export type BlueChipRisk = 'low' | 'medium'

export function blueChipRisk(pool: Pool): BlueChipRisk {
  if (pool.stablecoin || pool.ilRisk === 'no') return 'low'
  if ((pool.tvlUsd ?? 0) >= 1_000_000 && (pool.volumeUsd1d ?? 0) >= 100_000) return 'low'
  return 'medium'
}

export function isStableStablePair(pool: Pool): boolean {
  const matches = poolBlueChipMatches(pool)
  if (matches.length < 2) return false
  return matches.every((k) => STABLES.has(k))
}

export function isHighSecurityBlueChipPool(pool: Pool): boolean {
  if (isStableStablePair(pool)) return true
  return pool.ilRisk === 'no' && blueChipRisk(pool) === 'low'
}

/**
 * Ordenação: Solana primeiro, depois maior TVL (valor de mercado / liquidez),
 * pares estáveis, risco, APR.
 */
export function orderBestPools(a: Pool, b: Pool): number {
  const solA = canonicalLlamaChain(a.chain) === 'Solana' ? 1 : 0
  const solB = canonicalLlamaChain(b.chain) === 'Solana' ? 1 : 0
  if (solA !== solB) return solB - solA

  const tvl = (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0)
  if (tvl !== 0) return tvl

  const stabA = isStableStablePair(a) ? 1 : 0
  const stabB = isStableStablePair(b) ? 1 : 0
  if (stabA !== stabB) return stabB - stabA

  const riskA = blueChipRisk(a) === 'low' ? 1 : 0
  const riskB = blueChipRisk(b) === 'low' ? 1 : 0
  if (riskA !== riskB) return riskB - riskA

  return (b.apy ?? 0) - (a.apy ?? 0)
}

/**
 * Pipeline Blue Chips: ativos fortes + large-cap DeFi (tipo PENDLE/ONDO/UNI), só Solana + Ethereum,
 * DEX por rede, TVL mínimo modesto (lista parecida a filtros “blue-chip” de outros apps), sem memecoins.
 */
export function aplicarFiltroBlueChips(pools: Pool[]): Pool[] {
  return pools
    .filter(isBlueChipPool)
    .filter(hasGoodLiquidity)
    .filter(isNotBlacklistedPool)
    .sort(orderBestPools)
}
