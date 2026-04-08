/**
 * Ativos do conversor: cripto (id CoinGecko) ↔ moeda de cotação (vs_currencies).
 */

export type CalculatorAssetType = 'crypto' | 'fiat'

export type CalculatorAsset = {
  id: string
  symbol: string
  name: string
  type: CalculatorAssetType
  label: string
}

/** Moedas padrão (par inicial e fallback de normalização). */
export const DEFAULT_CALCULATOR_ASSETS: CalculatorAsset[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    type: 'crypto',
    label: 'Bitcoin (BTC)',
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    type: 'crypto',
    label: 'Ethereum (ETH)',
  },
  {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    type: 'crypto',
    label: 'Solana (SOL)',
  },
  {
    id: 'tether',
    symbol: 'USDT',
    name: 'Tether',
    type: 'crypto',
    label: 'Tether (USDT)',
  },
  {
    id: 'usd',
    symbol: 'USD',
    name: 'US Dollar',
    type: 'fiat',
    label: 'USD',
  },
  {
    id: 'brl',
    symbol: 'BRL',
    name: 'Brazilian Real',
    type: 'fiat',
    label: 'BRL',
  },
]

/** vs_currencies que convém mostrar com mais casas (preço em outra cripto). */
export const VS_IDS_SIX_DECIMALS = new Set([
  'btc',
  'eth',
  'sol',
  'bnb',
  'xrp',
  'ada',
  'doge',
  'ltc',
  'bch',
  'avax',
  'dot',
  'link',
  'matic',
  'pol',
  'shib',
  'trx',
])

const VS_NAME_HINT: Record<string, string> = {
  usd: 'US Dollar',
  brl: 'Brazilian Real',
  eur: 'Euro',
  gbp: 'British Pound',
  jpy: 'Japanese Yen',
  chf: 'Swiss Franc',
  cad: 'Canadian Dollar',
  aud: 'Australian Dollar',
  cny: 'Chinese Yuan',
  mxn: 'Mexican Peso',
  ars: 'Argentine Peso',
  clp: 'Chilean Peso',
  cop: 'Colombian Peso',
  btc: 'Bitcoin',
  eth: 'Ethereum',
  sol: 'Solana',
  xau: 'Gold',
}

export function buildCoinAsset(hit: { id: string; name: string; symbol: string }): CalculatorAsset {
  const sym = String(hit.symbol || '').toUpperCase() || hit.id
  return {
    id: hit.id,
    symbol: sym,
    name: hit.name || hit.id,
    type: 'crypto',
    label: `${hit.name} (${sym})`,
  }
}

export function buildVsAsset(code: string): CalculatorAsset {
  const id = code.trim().toLowerCase()
  const sym = id.toUpperCase()
  return {
    id,
    symbol: sym,
    name: VS_NAME_HINT[id] ?? sym,
    type: 'fiat',
    label: VS_NAME_HINT[id] ? `${sym} — ${VS_NAME_HINT[id]}` : sym,
  }
}

export function findDefaultAssetById(assetId: string): CalculatorAsset | undefined {
  return DEFAULT_CALCULATOR_ASSETS.find((a) => a.id === assetId)
}

export function pickDefaultPairAssets(): { left: CalculatorAsset; right: CalculatorAsset } {
  const firstCrypto = DEFAULT_CALCULATOR_ASSETS.find((a) => a.type === 'crypto')
  const firstFiat = DEFAULT_CALCULATOR_ASSETS.find((a) => a.type === 'fiat')
  return {
    left: firstCrypto ?? DEFAULT_CALCULATOR_ASSETS[0],
    right: firstFiat ?? DEFAULT_CALCULATOR_ASSETS[4],
  }
}

export function normalizeCalculatorAssetPair(
  left: CalculatorAsset,
  right: CalculatorAsset
): { left: CalculatorAsset; right: CalculatorAsset } {
  const def = pickDefaultPairAssets()
  if (left.type !== right.type) {
    return { left, right }
  }
  if (left.type === 'crypto') {
    return { left, right: def.right }
  }
  return { left: def.left, right }
}

export function getCoinAndVsFromAssets(
  left: CalculatorAsset,
  right: CalculatorAsset
): { coinId: string; vsId: string } | null {
  if (left.type === right.type) return null
  const coin = left.type === 'crypto' ? left : right
  const vs = left.type === 'fiat' ? left : right
  return { coinId: coin.id, vsId: vs.id }
}

export function isVsSixDecimals(vsId: string): boolean {
  return VS_IDS_SIX_DECIMALS.has(vsId.toLowerCase())
}
