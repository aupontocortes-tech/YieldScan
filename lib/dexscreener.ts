import type { Pool } from './types'

const CHAIN_MAP: Record<string, string> = {
  Ethereum: 'ethereum',
  Solana: 'solana',
  Arbitrum: 'arbitrum',
  Base: 'base',
  Optimism: 'optimism',
  Polygon: 'polygon',
  BSC: 'bsc',
  Avalanche: 'avalanche',
  Fantom: 'fantom',
  Hyperliquid: 'hyperliquid',
  'Hyperliquid L1': 'hyperliquid',
}

export function getDexScreenerUrl(pool: Pool): string {
  const chain = CHAIN_MAP[pool.chain] ?? pool.chain.toLowerCase().replace(/\s+/g, '-')

  if (pool.pool?.startsWith('0x')) {
    return `https://dexscreener.com/${chain}/${pool.pool}`
  }

  if (pool.chain === 'Solana' && pool.pool?.trim()) {
    return `https://dexscreener.com/solana/${pool.pool.trim()}`
  }

  const symbol = pool.symbol.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
  return `https://dexscreener.com/${chain}?q=${encodeURIComponent(symbol)}`
}
