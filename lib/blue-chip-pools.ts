import type { Pool, PoolFilters } from './types'
import { canonicalLlamaChain } from './llama-chain'

/**
 * Foco do utilizador: Solana como rede principal + Ethereum.
 * Base retirada — concentra “corretoras” (DEX) líderes nessas duas chains.
 */
export const BLUE_CHIP_CHAINS = ['Solana', 'Ethereum'] as const

const BLUE_CHIP_CHAIN_SET_FOR_FILTERS = new Set<string>(BLUE_CHIP_CHAINS)

/** Evita lista vazia: tira «só oportunidade» e redes fora de Solana/Ethereum. */
export function sanitizeFiltersForCuratedBlueChips(f: PoolFilters): PoolFilters {
  let u = { ...f }
  if (f.chainCategory === 'opportunity') {
    u = { ...u, chainCategory: 'all', quickPreset: 'none' }
  }
  if (f.chains.length > 0) {
    const narrowed = f.chains.filter((c) => BLUE_CHIP_CHAIN_SET_FOR_FILTERS.has(canonicalLlamaChain(c)))
    u = { ...u, chains: narrowed.length === 0 ? [] : narrowed }
  }
  return u
}

/**
 * Solana: só as 3 DEX com maior liquidez/volume agregado em pools (Raydium, Orca, Meteora).
 * Sem Lifinity, Phoenix, etc.
 */
export const SOLANA_BLUE_CHIP_DEX_KEYWORDS = ['raydium', 'orca', 'meteora'] as const

/**
 * Ethereum: Uniswap (maior rede de pools / volume na prática nos dados agregados).
 * Sem Curve, Balancer, Sushi neste modo — menos “corretoras”, só o principal.
 */
export const ETHEREUM_BLUE_CHIP_DEX_KEYWORDS = ['uniswap'] as const

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
 * Aliases por “família” de ativo (DefiLlama usa variantes no símbolo).
 * Inclui o núcleo pedido: BTC/WBTC/CBBTC, ETH/WETH, SOL, stables, XAUT, SPY, NVDA, etc.
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

/** Liquidez mínima em USD (TVL agregado da pool na DefiLlama — equivalente a `liquidity` no teu pseudo-código). */
const MIN_BLUE_CHIP_LIQUIDITY_USD = 100_000

function normalizeToken(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function extractSymbolTokens(symbol: string): string[] {
  return symbol
    .split(/[/\-_|:\s]+/)
    .map((t) => normalizeToken(t))
    .filter(Boolean)
}

/** Tickers normalizados do par (símbolo + underlyingTokens). */
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

/** Quantas “famílias” blue chip aparecem na pool (ex.: USDC + SOL → 2). */
export function poolBlueChipMatches(pool: Pool): string[] {
  const tokens = poolTokenTickers(pool)
  return BLUE_CHIP_TARGET_KEYS.filter((key) => tokens.some((tok) => tokenMatchesBlueChipKey(tok, key)))
}

/**
 * Pelo menos 2 ativos da whitelist (par realmente composto por ativos fortes).
 * Um único `some()` permitiria USDC + memecoin — evitamos isso.
 */
function isBlueChip(pool: Pool): boolean {
  return poolBlueChipMatches(pool).length >= 2
}

/** Rede + DEX “tier 1” (camada extra de qualidade; dados vêm de `pool.chain` / `pool.project`). */
function passesBlueChipVenue(pool: Pool): boolean {
  const chain = canonicalLlamaChain(pool.chain)
  if (!BLUE_CHIP_CHAINS.includes(chain as (typeof BLUE_CHIP_CHAINS)[number])) return false
  return isAllowedBlueChipDex(chain, pool.project ?? '')
}

/** Pool é blue chip no sentido completo: ativos + venue. */
export function isBlueChipPool(pool: Pool): boolean {
  return isBlueChip(pool) && passesBlueChipVenue(pool)
}

/** Boa liquidez: TVL ≥ $100k (campo `tvlUsd` na API YieldScan / DefiLlama). */
export function hasGoodLiquidity(pool: Pool): boolean {
  const tvl = pool.tvlUsd
  return typeof tvl === 'number' && Number.isFinite(tvl) && tvl >= MIN_BLUE_CHIP_LIQUIDITY_USD
}

/** Mantém só pools sem tickers de meme na lista negra. */
export function removeLowQuality(pool: Pool): boolean {
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
 * Melhor primeiro: maior liquidez (TVL), depois pares estável–estável,
 * menor risco heurístico, desempate por APR; Solana só como último desempate.
 */
export function orderBestPools(a: Pool, b: Pool): number {
  const liq = (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0)
  if (liq !== 0) return liq

  const stabA = isStableStablePair(a) ? 1 : 0
  const stabB = isStableStablePair(b) ? 1 : 0
  if (stabA !== stabB) return stabB - stabA

  const riskA = blueChipRisk(a) === 'low' ? 1 : 0
  const riskB = blueChipRisk(b) === 'low' ? 1 : 0
  if (riskA !== riskB) return riskB - riskA

  const apy = (b.apy ?? 0) - (a.apy ?? 0)
  if (apy !== 0) return apy

  const solA = canonicalLlamaChain(a.chain) === 'Solana' ? 1 : 0
  const solB = canonicalLlamaChain(b.chain) === 'Solana' ? 1 : 0
  return solB - solA
}

/**
 * Pipeline do botão «Só blue chips»: ativos fortes, liquidez, sem lixo, ordenação por qualidade.
 */
export function aplicarFiltroBlueChips(pools: Pool[]): Pool[] {
  return pools
    .filter(isBlueChipPool)
    .filter(hasGoodLiquidity)
    .filter(removeLowQuality)
    .sort(orderBestPools)
}
