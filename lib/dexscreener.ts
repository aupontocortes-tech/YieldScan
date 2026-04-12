import type { Pool } from './types'

const CHAIN_MAP: Record<string, string> = {
  Ethereum: 'ethereum',
  Solana: 'solana',
  Arbitrum: 'arbitrum',
  Base: 'base',
  Optimism: 'optimism',
  Polygon: 'polygon',
  BSC: 'bsc',
  opBNB: 'opbnb',
  Avalanche: 'avalanche',
  Fantom: 'fantom',
  Hyperliquid: 'hyperliquid',
  'Hyperliquid L1': 'hyperliquid',
}

function sortedEvmUnderlying(pool: Pool): string[] {
  const tokens = (pool.underlyingTokens ?? [])
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter((t) => /^0x[a-fA-F0-9]{40}$/i.test(t))
    .map((t) => t.toLowerCase())
  return [...new Set(tokens)].sort((a, b) => a.localeCompare(b))
}

export function getDexScreenerUrl(pool: Pool): string {
  const chain = CHAIN_MAP[pool.chain] ?? pool.chain.toLowerCase().replace(/\s+/g, '-')

  if (pool.pool?.startsWith('0x')) {
    return `https://dexscreener.com/${chain}/${pool.pool}`
  }

  /** DefiLlama: `pool` UUID — DexScreener por endereço de token lista o par no topo em muitos casos. */
  if (chain !== 'solana' && chain !== 'hyperliquid') {
    const evm = sortedEvmUnderlying(pool)
    if (evm.length >= 2) {
      return `https://dexscreener.com/${chain}/${evm[0]}`
    }
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
