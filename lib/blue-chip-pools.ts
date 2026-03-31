import type { Pool } from './types'
import { canonicalLlamaChain } from './llama-chain'

export const BLUE_CHIP_CHAINS = ['Ethereum', 'Base', 'Solana'] as const
export const BLUE_CHIP_DEX_KEYWORDS = ['uniswap', 'aerodrome', 'raydium', 'orca'] as const

const TOKEN_ALIAS: Record<string, string[]> = {
  BTC: ['BTC', 'WBTC'],
  WBTC: ['WBTC', 'BTC'],
  ETH: ['ETH', 'WETH', 'STETH', 'WSTETH'],
  SOL: ['SOL', 'WSOL', 'MSOL', 'JITOSOL'],
  USDC: ['USDC', 'USDC.E'],
  USDT: ['USDT'],
  DAI: ['DAI'],
  XAUT: ['XAUT', 'PAXG', 'XAU', 'GOLD'],
  SP500: ['SP500', 'S&P500', 'SPX', 'SPY'],
}

const BLUE_CHIP_TARGETS = ['BTC', 'ETH', 'SOL', 'WBTC', 'USDC', 'USDT', 'DAI', 'XAUT', 'SP500'] as const
const STABLES = new Set(['USDC', 'USDT', 'DAI'])

function normalizeToken(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9&]/g, '')
}

function extractSymbolTokens(symbol: string): string[] {
  return symbol
    .split(/[\/\-_|:\s]+/)
    .map((t) => normalizeToken(t))
    .filter(Boolean)
}

function tokenMatchesAlias(token: string, target: string): boolean {
  const aliases = TOKEN_ALIAS[target] ?? [target]
  return aliases.some((alias) => token.includes(alias) || alias.includes(token))
}

export type BlueChipRisk = 'low' | 'medium'

export function blueChipRisk(pool: Pool): BlueChipRisk {
  if (pool.stablecoin || pool.ilRisk === 'no') return 'low'
  if ((pool.tvlUsd ?? 0) >= 1_000_000 && (pool.volumeUsd1d ?? 0) >= 100_000) return 'low'
  return 'medium'
}

export function poolTokenMatches(pool: Pool): string[] {
  const fromSymbol = extractSymbolTokens(pool.symbol ?? '')
  const merged = new Set(fromSymbol)
  for (const t of pool.underlyingTokens ?? []) {
    const n = normalizeToken(t)
    if (n) merged.add(n)
  }
  const tokens = [...merged]
  return BLUE_CHIP_TARGETS.filter((target) => tokens.some((tok) => tokenMatchesAlias(tok, target)))
}

export function isBlueChipPool(pool: Pool): boolean {
  const chain = canonicalLlamaChain(pool.chain)
  if (!BLUE_CHIP_CHAINS.includes(chain as (typeof BLUE_CHIP_CHAINS)[number])) return false
  const proj = (pool.project ?? '').toLowerCase()
  if (!BLUE_CHIP_DEX_KEYWORDS.some((k) => proj.includes(k))) return false
  return poolTokenMatches(pool).length >= 2
}

export function isHighSecurityBlueChipPool(pool: Pool): boolean {
  const matches = poolTokenMatches(pool)
  const allStable = matches.length >= 2 && matches.every((t) => STABLES.has(t))
  return allStable || (pool.ilRisk === 'no' && blueChipRisk(pool) === 'low')
}

