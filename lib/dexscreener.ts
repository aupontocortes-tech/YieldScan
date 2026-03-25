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

  if (pool.chain === 'Solana') {
    const raw = pool.pool?.trim() ?? ''
    const solMint =
      raw.startsWith('meteora-dlmm-') ? raw.replace(/^meteora-dlmm-/, '') : raw
    if (solMint && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solMint)) {
      return `https://dexscreener.com/solana/${solMint}`
    }
  }

  const symbol = pool.symbol.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
  return `https://dexscreener.com/${chain}?q=${encodeURIComponent(symbol)}`
}
