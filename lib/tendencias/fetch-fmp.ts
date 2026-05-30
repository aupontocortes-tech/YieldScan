/**
 * Financial Modeling Prep — cotações cripto (plano free ~250 req/dia).
 * Chave: FMP_API_KEY
 * https://site.financialmodelingprep.com/developer/docs
 */

export type FmpCryptoQuote = {
  symbol: string
  baseSymbol: string
  name: string
  price: number | null
  changePct24h: number | null
  marketCap: number | null
  volume24h: number | null
  yearHigh: number | null
  yearLow: number | null
  ma50: number | null
  ma200: number | null
}

const FMP_BASE = 'https://financialmodelingprep.com/api/v3'

function fmpKey(): string {
  return process.env.FMP_API_KEY?.trim() ?? ''
}

function toBaseSymbol(fmpSymbol: string): string {
  return fmpSymbol.replace(/USD(T)?$/i, '').toUpperCase()
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

type FmpRawQuote = Record<string, unknown>

function mapQuote(raw: FmpRawQuote): FmpCryptoQuote | null {
  const symbol = String(raw.symbol ?? '').toUpperCase()
  if (!symbol.endsWith('USD')) return null
  const price = num(raw.price)
  if (price == null) return null

  return {
    symbol,
    baseSymbol: toBaseSymbol(symbol),
    name: String(raw.name ?? symbol),
    price,
    changePct24h: num(raw.changesPercentage ?? raw.changePercentage ?? raw.change),
    marketCap: num(raw.marketCap),
    volume24h: num(raw.volume),
    yearHigh: num(raw.yearHigh),
    yearLow: num(raw.yearLow),
    ma50: num(raw.priceAvg50 ?? raw.day50MovingAvg),
    ma200: num(raw.priceAvg200 ?? raw.day200MovingAvg),
  }
}

/** Uma chamada — lista completa de cripto (economiza quota free). */
export async function fetchFmpCryptoQuotes(): Promise<Map<string, FmpCryptoQuote>> {
  const key = fmpKey()
  const out = new Map<string, FmpCryptoQuote>()
  if (!key) return out

  try {
    const url = `${FMP_BASE}/quotes/crypto?apikey=${encodeURIComponent(key)}`
    const res = await fetch(url, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return out
    const rows = (await res.json()) as FmpRawQuote[]
    if (!Array.isArray(rows)) return out

    for (const raw of rows) {
      const q = mapQuote(raw)
      if (q) out.set(q.baseSymbol, q)
    }
  } catch {
    return out
  }

  return out
}

export function fmpMaPosition(
  price: number | null,
  ma: number | null,
): 'above' | 'below' | null {
  if (price == null || ma == null || ma <= 0) return null
  return price >= ma ? 'above' : 'below'
}

export function fmpDistFromHighPct(price: number | null, yearHigh: number | null): number | null {
  if (price == null || yearHigh == null || yearHigh <= 0) return null
  return ((yearHigh - price) / yearHigh) * 100
}
