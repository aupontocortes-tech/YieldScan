import type { Pool } from './types'
import { canonicalLlamaChain } from './llama-chain'

/** Ordem fixa das redes “principais” na UI (máx. 7). */
export const MARKET_PRIMARY_CHAINS = [
  'Ethereum',
  'Arbitrum',
  'Base',
  'Solana',
  'BSC',
  'Polygon',
  'Optimism',
] as const

export type MarketPrimaryChain = (typeof MARKET_PRIMARY_CHAINS)[number]

const PRIMARY_SET = new Set<string>(MARKET_PRIMARY_CHAINS)

/**
 * DEX curadas por rede (substring no slug `project` da DefiLlama, case-insensitive).
 */
export const CURATED_DEX_KEYWORDS: Record<MarketPrimaryChain, readonly string[]> = {
  Ethereum: ['uniswap', 'curve', 'balancer'],
  Arbitrum: ['uniswap', 'curve', 'balancer'],
  Optimism: ['uniswap', 'curve', 'balancer'],
  Base: ['aerodrome', 'uniswap'],
  Solana: ['orca', 'raydium', 'meteora'],
  BSC: ['pancake'],
  Polygon: ['quickswap', 'uniswap'],
}

export function isMarketPrimaryChain(chain: string): boolean {
  return PRIMARY_SET.has(canonicalLlamaChain(chain))
}

export function primaryChainsPresentInData(chainOptions: string[]): MarketPrimaryChain[] {
  const set = new Set(chainOptions.map((c) => canonicalLlamaChain(c)))
  return MARKET_PRIMARY_CHAINS.filter((c) => set.has(c))
}

export function secondaryChainsInData(chainOptions: string[]): string[] {
  return chainOptions
    .filter((c) => !PRIMARY_SET.has(canonicalLlamaChain(c)))
    .sort((a, b) => a.localeCompare(b))
}

export function matchesCuratedDex(chain: string, project: string): boolean {
  const c = canonicalLlamaChain(chain) as MarketPrimaryChain
  const kws = CURATED_DEX_KEYWORDS[c]
  if (!kws) return false
  const p = project.toLowerCase()
  return kws.some((k) => p.includes(k))
}

export function poolMatchesSelectedChains(pool: Pool, selectedChains: string[]): boolean {
  if (selectedChains.length === 0) return true
  const pc = canonicalLlamaChain(pool.chain)
  return selectedChains.some((c) => canonicalLlamaChain(c) === pc)
}
