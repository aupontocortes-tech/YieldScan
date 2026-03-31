import type { Pool } from './types'
import { canonicalLlamaChain } from './llama-chain'

export const BLUE_CHIP_CHAINS = ['Ethereum', 'Base', 'Solana'] as const
export const BLUE_CHIP_DEX_KEYWORDS = ['uniswap', 'aerodrome', 'raydium', 'orca'] as const

/** Tickers “blue chip” + aliases comuns nos símbolos DefiLlama. */
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
  XAUT: ['XAUT', 'PAXG', 'XAU', 'GOLD'],
  SP500: ['SP500', 'S&P500', 'SPX'],
  SPY: ['SPY'],
  NVDA: ['NVDA'],
}

const BLUE_CHIP_TARGET_KEYS = Object.keys(TOKEN_ALIAS) as (keyof typeof TOKEN_ALIAS)[]
const STABLES = new Set(['USDC', 'USDT', 'DAI'])

const MEME_BLACKLIST = new Set([
  'DOGE',
  'SHIB',
  'PEPE',
  'FLOKI',
  'BONK',
  'WIF',
  'MEME',
])

const MIN_BLUE_CHIP_TVL_USD = 100_000

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

/** Pelo menos 2 ativos da lista blue chip (critério original). */
export function isBlueChipPool(pool: Pool): boolean {
  const chain = canonicalLlamaChain(pool.chain)
  if (!BLUE_CHIP_CHAINS.includes(chain as (typeof BLUE_CHIP_CHAINS)[number])) return false
  const proj = (pool.project ?? '').toLowerCase()
  if (!BLUE_CHIP_DEX_KEYWORDS.some((k) => proj.includes(k))) return false
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

/** Ordenação “melhores primeiro”: pares estáveis, menor risco heurístico, TVL, APR. */
export function orderBestPools(a: Pool, b: Pool): number {
  const stabA = isStableStablePair(a) ? 1 : 0
  const stabB = isStableStablePair(b) ? 1 : 0
  if (stabA !== stabB) return stabB - stabA

  const riskA = blueChipRisk(a) === 'low' ? 1 : 0
  const riskB = blueChipRisk(b) === 'low' ? 1 : 0
  if (riskA !== riskB) return riskB - riskA

  const tvl = (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0)
  if (tvl !== 0) return tvl

  return (b.apy ?? 0) - (a.apy ?? 0)
}

/**
 * Pipeline principal Blue Chips: ativos fortes + venue + liquidez mínima + sem memecoins + ordenação.
 */
export function aplicarFiltroBlueChips(pools: Pool[]): Pool[] {
  return pools
    .filter(isBlueChipPool)
    .filter(hasGoodLiquidity)
    .filter(isNotBlacklistedPool)
    .sort(orderBestPools)
}
