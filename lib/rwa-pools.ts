import type { Pool, PoolFilters } from './types'
import { canonicalLlamaChain } from './llama-chain'
import { poolTokenTickers } from './blue-chip-pools'

/**
 * Redes onde pools RWA aparecem com mais frequência (Solana em primeiro lugar).
 * Hyperliquid L1 = rótulo canônico usado no app (DefiLlama pode variar).
 */
export const RWA_CHAINS = [
  'Solana',
  'Hyperliquid L1',
  'Ethereum',
  'Arbitrum',
  'Base',
] as const

const RWA_CHAIN_SET = new Set<string>(RWA_CHAINS)

/** DEXs Solana usuais para liquidez RWA tokenizada. */
export const SOLANA_RWA_DEX_KEYWORDS = ['raydium', 'orca', 'meteora', 'ondo'] as const

export const HYPERLIQUID_DEX_KEYWORDS = ['hyperliquid'] as const

export const EVM_RWA_DEX_KEYWORDS = ['uniswap', 'curve', 'balancer', 'ondo', 'maple', 'pendle'] as const

/**
 * Tickers / famílias de ativos do mundo real (treasury, ações tokenizadas, ouro, crédito).
 */
const RWA_TOKEN_ALIAS: Record<string, string[]> = {
  ONDO: ['ONDO'],
  USDY: ['USDY', 'OUSG', 'OUSDC'],
  USDM: ['USDM'],
  TBILL: ['TBILL', 'BILL', 'USTB', 'BUIDL'],
  RWA: ['RWA', 'RWAX', 'XRWA'],
  XAUT: ['XAUT', 'PAXG', 'GOLD', 'GLD'],
  SPY: ['SPY'],
  NVDA: ['NVDA'],
  TSLA: ['TSLA'],
  AAPL: ['AAPL'],
  AMZN: ['AMZN'],
  GOOGL: ['GOOGL', 'GOOG'],
  MSFT: ['MSFT'],
  META: ['META'],
  QQQ: ['QQQ'],
  VOO: ['VOO'],
  SP500: ['SP500', 'SPX'],
  USO: ['USO'],
  WTI: ['WTI', 'OIL'],
  BRENT: ['BRENT'],
  PENDLE: ['PENDLE'],
  MPL: ['MPL'],
  CFG: ['CFG'],
  TRU: ['TRU'],
  USDC: ['USDC', 'USDC.E', 'USDCE'],
  USDT: ['USDT'],
}

const RWA_TOKEN_KEYS = Object.keys(RWA_TOKEN_ALIAS)

function normalizeToken(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function tokenMatchesRwaKey(token: string, key: string): boolean {
  const aliases = RWA_TOKEN_ALIAS[key].map((x) => normalizeToken(x))
  return aliases.includes(token)
}

/** Famílias RWA presentes no par. */
export function poolRwaMatches(pool: Pool): string[] {
  const tokens = poolTokenTickers(pool)
  const fromKeys = RWA_TOKEN_KEYS.filter((key) =>
    tokens.some((tok) => tokenMatchesRwaKey(tok, key))
  )
  if (fromKeys.length > 0) return fromKeys

  const sym = (pool.symbol ?? '').toUpperCase()
  if (/\bRWA\b/.test(sym) || sym.includes('REALWORLD') || sym.includes('T-BILL')) {
    return ['RWA']
  }
  const project = (pool.project ?? '').toLowerCase()
  if (project.includes('ondo') || project.includes('maple') || project.includes('backed')) {
    return ['protocol-rwa']
  }
  return []
}

function isAllowedRwaVenue(chain: string, project: string): boolean {
  const p = (project ?? '').toLowerCase()
  if (chain === 'Solana') {
    return SOLANA_RWA_DEX_KEYWORDS.some((k) => p.includes(k))
  }
  if (chain === 'Hyperliquid L1') {
    return HYPERLIQUID_DEX_KEYWORDS.some((k) => p.includes(k)) || p.length > 0
  }
  if (chain === 'Ethereum' || chain === 'Arbitrum' || chain === 'Base') {
    return EVM_RWA_DEX_KEYWORDS.some((k) => p.includes(k))
  }
  return false
}

export function isRwaPool(pool: Pool): boolean {
  const chain = canonicalLlamaChain(pool.chain)
  if (!RWA_CHAIN_SET.has(chain)) return false
  if (poolRwaMatches(pool).length === 0) return false
  return isAllowedRwaVenue(chain, pool.project ?? '')
}

/** Ao ativar RWA, não força redes — o utilizador ajusta chips; só evita categoria “oportunidade”. */
export function sanitizeFiltersForCuratedRwa(f: PoolFilters): PoolFilters {
  let u = { ...f, curatedBlueChipsOnly: false }
  if (f.chainCategory === 'opportunity') {
    u = { ...u, chainCategory: 'all', quickPreset: 'none' }
  }
  return u
}

export function orderRwaPools(a: Pool, b: Pool): number {
  const chainScore = (p: Pool) => {
    const c = canonicalLlamaChain(p.chain)
    if (c === 'Solana') return 3
    if (c === 'Hyperliquid L1') return 2
    return 1
  }
  const cs = chainScore(b) - chainScore(a)
  if (cs !== 0) return cs

  const tvl = (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0)
  if (tvl !== 0) return tvl

  return (b.apy ?? 0) - (a.apy ?? 0)
}

export function aplicarFiltroRwa(pools: Pool[]): Pool[] {
  return pools.filter(isRwaPool).sort(orderRwaPools)
}
