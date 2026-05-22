/**
 * Pares do dashboard Indicadores — Binance (cripto) ou CoinGecko OHLC (USD, RWAs/xStock).
 */

import { MERCADO_HIGHLIGHT_QUICK_PRESETS } from '@/lib/mercado-highlight-presets'

export type IndicatorPairSource = 'binance' | 'coingecko'

export type IndicatorPair = {
  id: string
  label: string
  base: string
  quote: string
  source: IndicatorPairSource
  binanceSymbol?: string
  coingeckoId?: string
}

const BINANCE_SYMBOLS: { symbol: string; base: string; quote: string }[] = [
  { symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT' },
  { symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT' },
  { symbol: 'SOLUSDT', base: 'SOL', quote: 'USDT' },
  { symbol: 'BNBUSDT', base: 'BNB', quote: 'USDT' },
  { symbol: 'XRPUSDT', base: 'XRP', quote: 'USDT' },
  { symbol: 'ADAUSDT', base: 'ADA', quote: 'USDT' },
  { symbol: 'DOGEUSDT', base: 'DOGE', quote: 'USDT' },
  { symbol: 'AVAXUSDT', base: 'AVAX', quote: 'USDT' },
  { symbol: 'LINKUSDT', base: 'LINK', quote: 'USDT' },
  { symbol: 'DOTUSDT', base: 'DOT', quote: 'USDT' },
  { symbol: 'MATICUSDT', base: 'MATIC', quote: 'USDT' },
  { symbol: 'LTCUSDT', base: 'LTC', quote: 'USDT' },
  { symbol: 'TRXUSDT', base: 'TRX', quote: 'USDT' },
  { symbol: 'ATOMUSDT', base: 'ATOM', quote: 'USDT' },
  { symbol: 'NEARUSDT', base: 'NEAR', quote: 'USDT' },
  { symbol: 'ARBUSDT', base: 'ARB', quote: 'USDT' },
  { symbol: 'OPUSDT', base: 'OP', quote: 'USDT' },
  { symbol: 'SUIUSDT', base: 'SUI', quote: 'USDT' },
  { symbol: 'APTUSDT', base: 'APT', quote: 'USDT' },
  { symbol: 'INJUSDT', base: 'INJ', quote: 'USDT' },
  { symbol: 'PEPEUSDT', base: 'PEPE', quote: 'USDT' },
  { symbol: 'SHIBUSDT', base: 'SHIB', quote: 'USDT' },
  { symbol: 'WIFUSDT', base: 'WIF', quote: 'USDT' },
  { symbol: 'ETHBTC', base: 'ETH', quote: 'BTC' },
  { symbol: 'SOLBTC', base: 'SOL', quote: 'BTC' },
  { symbol: 'BNBBTC', base: 'BNB', quote: 'BTC' },
  { symbol: 'BTCUSDC', base: 'BTC', quote: 'USDC' },
  { symbol: 'ETHUSDC', base: 'ETH', quote: 'USDC' },
]

const COINGECKO_CRYPTO: { id: string; base: string }[] = [
  { id: 'bitcoin', base: 'BTC' },
  { id: 'ethereum', base: 'ETH' },
  { id: 'solana', base: 'SOL' },
  { id: 'hyperliquid', base: 'HYPE' },
  { id: 'binancecoin', base: 'BNB' },
  { id: 'ripple', base: 'XRP' },
  { id: 'cardano', base: 'ADA' },
  { id: 'chainlink', base: 'LINK' },
  { id: 'avalanche-2', base: 'AVAX' },
]

function binancePair(row: (typeof BINANCE_SYMBOLS)[number]): IndicatorPair {
  return {
    id: `binance-${row.symbol.toLowerCase()}`,
    label: `${row.base} / ${row.quote}`,
    base: row.base,
    quote: row.quote,
    source: 'binance',
    binanceSymbol: row.symbol,
  }
}

function coingeckoUsdPair(id: string, base: string, name?: string): IndicatorPair {
  const label = name ? `${name} / USD` : `${base} / USD`
  return {
    id: `coingecko-${id}`,
    label,
    base: name ?? base,
    quote: 'USD',
    source: 'coingecko',
    coingeckoId: id,
  }
}

const BINANCE_PAIRS = BINANCE_SYMBOLS.map(binancePair)

const CRYPTO_CG_PAIRS = COINGECKO_CRYPTO.map((c) => coingeckoUsdPair(c.id, c.base))

const RWA_PAIRS: IndicatorPair[] = MERCADO_HIGHLIGHT_QUICK_PRESETS.map((p) =>
  coingeckoUsdPair(p.id, p.symbol, p.name),
)

/** Lista curada + pesquisa por símbolo CoinGecko ou par Binance. */
export const INDICATOR_PAIR_PRESETS: IndicatorPair[] = [
  ...BINANCE_PAIRS,
  ...RWA_PAIRS,
  ...CRYPTO_CG_PAIRS.filter((c) => !BINANCE_PAIRS.some((b) => b.base === c.base && c.quote === 'USDT')),
]

const BY_ID = new Map(INDICATOR_PAIR_PRESETS.map((p) => [p.id, p]))

export const DEFAULT_INDICATOR_PAIR_ID = 'binance-btcusdt'

export function getIndicatorPair(id: string): IndicatorPair | undefined {
  return BY_ID.get(id.trim().toLowerCase())
}

export function getDefaultIndicatorPair(): IndicatorPair {
  return getIndicatorPair(DEFAULT_INDICATOR_PAIR_ID) ?? BINANCE_PAIRS[0]!
}

export function indicatorPairSourceHint(pair: IndicatorPair): string {
  return pair.source === 'binance' ? 'Binance' : 'CoinGecko · USD'
}

/** Resolve texto livre: ETHUSDT, tesla-xstock, coingecko:…, binance:… */
export function resolveIndicatorPairInput(raw: string): IndicatorPair | null {
  const t = raw.trim()
  if (!t) return null

  const lower = t.toLowerCase().replace(/\s+/g, '')
  const preset = BY_ID.get(lower)
  if (preset) return preset

  if (lower.startsWith('binance:')) {
    const sym = lower.slice(8).toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (sym.length >= 6) return buildBinanceFromSymbol(sym)
  }
  if (lower.startsWith('coingecko:') || lower.startsWith('cg:')) {
    const id = lower.replace(/^coingecko:/, '').replace(/^cg:/, '').replace(/[^a-z0-9_-]/g, '')
    if (id.length >= 2) return coingeckoUsdPair(id, id.toUpperCase().slice(0, 8))
  }

  const slug = lower.replace(/[^a-z0-9_-]/g, '')
  if (slug.includes('-xstock') || slug.includes('xstock')) {
    const hit = RWA_PAIRS.find((p) => p.coingeckoId === slug)
    if (hit) return hit
    return coingeckoUsdPair(slug, slug.toUpperCase().slice(0, 6))
  }

  const upper = t.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (upper.length >= 6 && /^[A-Z0-9]+$/.test(upper)) {
    const fromBinance = buildBinanceFromSymbol(upper)
    if (fromBinance) return fromBinance
  }

  if (/^[a-z0-9_-]{2,80}$/.test(slug)) {
    const cgHit = INDICATOR_PAIR_PRESETS.find((p) => p.coingeckoId === slug)
    if (cgHit) return cgHit
    return coingeckoUsdPair(slug, slug.toUpperCase().slice(0, 8))
  }

  return null
}

function buildBinanceFromSymbol(symbol: string): IndicatorPair | null {
  if (!/^[A-Z0-9]{6,24}$/.test(symbol)) return null
  const hit = BINANCE_PAIRS.find((p) => p.binanceSymbol === symbol)
  if (hit) return hit

  const quotes = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'EUR', 'FDUSD']
  for (const q of quotes) {
    if (symbol.endsWith(q) && symbol.length > q.length) {
      const base = symbol.slice(0, -q.length)
      return {
        id: `binance-${symbol.toLowerCase()}`,
        label: `${base} / ${q}`,
        base,
        quote: q,
        source: 'binance',
        binanceSymbol: symbol,
      }
    }
  }
  return null
}

export function filterIndicatorPairs(query: string): IndicatorPair[] {
  const q = query.trim().toLowerCase()
  if (!q) return INDICATOR_PAIR_PRESETS
  return INDICATOR_PAIR_PRESETS.filter(
    (p) =>
      p.label.toLowerCase().includes(q) ||
      p.base.toLowerCase().includes(q) ||
      p.quote.toLowerCase().includes(q) ||
      p.binanceSymbol?.toLowerCase().includes(q) ||
      p.coingeckoId?.includes(q) ||
      p.id.includes(q),
  )
}
