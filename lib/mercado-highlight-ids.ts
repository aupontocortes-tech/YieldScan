/**
 * IDs CoinGecko (slug) para os cartões grandes do mercado.
 * Preferências guardadas só no browser (localStorage).
 */

export const DEFAULT_MARKET_HIGHLIGHT_IDS = [
  'bitcoin',
  'ethereum',
  'solana',
  'hyperliquid',
] as const

/** Máximo de moedas em destaque (URL + CoinGecko simple/price). */
export const MAX_MARKET_HIGHLIGHTS = 12

const STORAGE_KEY = 'yieldscan-mercado-highlight-ids'

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/

/**
 * Ticker ou slug errado → id oficial CoinGecko (simple/price só aceita o slug da API).
 * Ex.: usdt → tether, bnb → binancecoin.
 */
export const COINGECKO_HIGHLIGHT_ALIASES: Record<string, string> = {
  sdt: 'tether',
  usdt: 'tether',
  'usd-t': 'tether',
  usdc: 'usd-coin',
  'usd-c': 'usd-coin',
  btc: 'bitcoin',
  xbt: 'bitcoin',
  eth: 'ethereum',
  sol: 'solana',
  bnb: 'binancecoin',
  xrp: 'ripple',
  doge: 'dogecoin',
  link: 'chainlink',
  avax: 'avalanche',
  dot: 'polkadot',
  matic: 'polygon-ecosystem-token',
  'matic-network': 'polygon-ecosystem-token',
  pol: 'polygon-ecosystem-token',
  ada: 'cardano',
  ltc: 'litecoin',
  bch: 'bitcoin-cash',
  trx: 'tron',
  shib: 'shiba-inu',
  uni: 'uniswap',
  atom: 'cosmos',
  etc: 'ethereum-classic',
  xlm: 'stellar',
  near: 'near',
  apt: 'aptos',
  sui: 'sui',
  arb: 'arbitrum',
  op: 'optimism',
  hype: 'hyperliquid',
  wbtc: 'wrapped-bitcoin',
  weth: 'weth',
  steth: 'staked-ether',
  dai: 'dai',
}

export function canonicalHighlightCoinGeckoId(raw: string): string {
  const t = String(raw).trim().toLowerCase()
  if (!t) return ''
  return COINGECKO_HIGHLIGHT_ALIASES[t] ?? t
}

export function sanitizeHighlightIds(raw: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of raw) {
    const id = canonicalHighlightCoinGeckoId(String(s))
    if (!id || !ID_RE.test(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= MAX_MARKET_HIGHLIGHTS) break
  }
  return out.length > 0 ? out : [...DEFAULT_MARKET_HIGHLIGHT_IDS]
}

/** Query ?highlights=bitcoin,ethereum,... */
export function parseHighlightsQueryParam(param: string | null): string[] {
  if (!param?.trim()) return [...DEFAULT_MARKET_HIGHLIGHT_IDS]
  const parts = param
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
  return sanitizeHighlightIds(parts)
}

export function readStoredHighlightIds(): string[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return sanitizeHighlightIds(parsed.map(String))
  } catch {
    return null
  }
}

export function writeStoredHighlightIds(ids: string[]): void {
  const next = sanitizeHighlightIds(ids)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function clearStoredHighlightIds(): void {
  localStorage.removeItem(STORAGE_KEY)
}
