/**
 * Fallback de preços via Binance spot quando CoinGecko limita (429).
 */

export const COINGECKO_BINANCE_SYMBOL: Record<string, string> = {
  bitcoin: 'BTCUSDT',
  ethereum: 'ETHUSDT',
  solana: 'SOLUSDT',
  binancecoin: 'BNBUSDT',
  bnb: 'BNBUSDT',
  ripple: 'XRPUSDT',
  cardano: 'ADAUSDT',
  chainlink: 'LINKUSDT',
  'avalanche-2': 'AVAXUSDT',
  avalanche: 'AVAXUSDT',
  dogecoin: 'DOGEUSDT',
  polkadot: 'DOTUSDT',
  litecoin: 'LTCUSDT',
  tron: 'TRXUSDT',
  cosmos: 'ATOMUSDT',
  near: 'NEARUSDT',
  arbitrum: 'ARBUSDT',
  optimism: 'OPUSDT',
  sui: 'SUIUSDT',
  aptos: 'APTUSDT',
  'injective-protocol': 'INJUSDT',
  pepe: 'PEPEUSDT',
  'shiba-inu': 'SHIBUSDT',
  shiba: 'SHIBUSDT',
  dogwifcoin: 'WIFUSDT',
  uniswap: 'UNIUSDT',
  hyperliquid: 'HYPEUSDT',
  pendle: 'PENDLEUSDT',
  aave: 'AAVEUSDT',
}

export const STABLE_COINGECKO_IDS = new Set([
  'tether',
  'usd-coin',
  'dai',
  'binance-usd',
  'true-usd',
  'first-digital-usd',
  'paypal-usd',
  'gemini-dollar',
  'liquity-usd',
  'usdd',
])

export type BinanceSpotQuote = {
  price: number
  change_24h: number
}

type BinanceTickerRow = {
  symbol?: string
  lastPrice?: string
  priceChangePercent?: string
}

let binanceCache: { at: number; bySymbol: Map<string, BinanceSpotQuote> } | null = null
const BINANCE_CACHE_MS = 45_000

export function syntheticStableQuote(): BinanceSpotQuote {
  return { price: 1, change_24h: 0 }
}

export async function fetchBinanceSpotQuotes(
  coingeckoIds: string[],
): Promise<Map<string, BinanceSpotQuote>> {
  const out = new Map<string, BinanceSpotQuote>()
  const symbols: string[] = []
  const idBySymbol = new Map<string, string>()

  for (const raw of coingeckoIds) {
    const id = raw.trim().toLowerCase()
    if (!id) continue
    if (STABLE_COINGECKO_IDS.has(id)) {
      out.set(id, syntheticStableQuote())
      continue
    }
    const sym = COINGECKO_BINANCE_SYMBOL[id]
    if (!sym || idBySymbol.has(sym)) continue
    idBySymbol.set(sym, id)
    symbols.push(sym)
  }

  if (symbols.length === 0) return out

  const now = Date.now()
  if (binanceCache && now - binanceCache.at < BINANCE_CACHE_MS) {
    for (const sym of symbols) {
      const id = idBySymbol.get(sym)
      const q = binanceCache.bySymbol.get(sym)
      if (id && q) out.set(id, q)
    }
    return out
  }

  try {
    const param = encodeURIComponent(JSON.stringify(symbols))
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${param}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return out
    const rows = (await res.json()) as BinanceTickerRow[]
    const bySymbol = new Map<string, BinanceSpotQuote>()
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const sym = String(row.symbol ?? '').toUpperCase()
        const price = Number(row.lastPrice)
        const ch = Number(row.priceChangePercent)
        if (!sym || !Number.isFinite(price) || price <= 0) continue
        bySymbol.set(sym, {
          price,
          change_24h: Number.isFinite(ch) ? ch : 0,
        })
      }
    }
    binanceCache = { at: now, bySymbol }
    for (const sym of symbols) {
      const id = idBySymbol.get(sym)
      const q = bySymbol.get(sym)
      if (id && q) out.set(id, q)
    }
  } catch {
    /* ignore */
  }

  return out
}
