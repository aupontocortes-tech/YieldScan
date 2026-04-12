import { NextRequest, NextResponse } from 'next/server'
import { getCoingeckoRequestParts } from '@/lib/coingecko-server'

type MarketRow = {
  id?: string
  symbol?: string
  name?: string
  current_price?: number | null
  price_change_percentage_24h?: number | null
  price_change_percentage_7d?: number | null
  price_change_percentage_7d_in_currency?: number | null
}

function parseSymbols(raw: string): string[] {
  const parts = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  return [...new Set(parts)].slice(0, 120)
}

/** IDs internos CoinGecko (ex.: bitcoin, solana). */
function parseGeckoIds(raw: string): string[] {
  const parts = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z0-9_-]{1,80}$/.test(s))
  return [...new Set(parts)].slice(0, 150)
}

type ListRow = { id: string; symbol: string; name: string }

let coinsListCache: { at: number; rows: ListRow[] } | null = null
const LIST_TTL_MS = 60 * 60 * 1000

async function loadCoinsList(): Promise<ListRow[]> {
  if (coinsListCache && Date.now() - coinsListCache.at < LIST_TTL_MS) {
    return coinsListCache.rows
  }
  const { base, headers } = getCoingeckoRequestParts()
  const res = await fetch(`${base}/coins/list`, {
    headers,
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    return coinsListCache?.rows ?? []
  }
  const data = (await res.json()) as Array<{ id?: string; symbol?: string; name?: string }>
  const rows: ListRow[] = Array.isArray(data)
    ? data
        .map((r) => ({
          id: String(r.id ?? '').trim().toLowerCase(),
          symbol: String(r.symbol ?? '').trim(),
          name: String(r.name ?? '').trim(),
        }))
        .filter((r) => r.id && r.symbol)
    : []
  coinsListCache = { at: Date.now(), rows }
  return rows
}

async function symbolsToGeckoIds(symbols: string[]): Promise<string[]> {
  const list = await loadCoinsList()
  const out: string[] = []
  for (const sym of symbols) {
    const u = sym.toUpperCase()
    const hit = list.find((r) => r.symbol.toUpperCase() === u)
    if (hit) out.push(hit.id)
  }
  return [...new Set(out)]
}

function rowFromMarket(m: MarketRow): {
  price: number
  pct24h: number
  pct7d: number
  name: string
  geckoId: string
  cmcId: number
} {
  const geckoId = String(m.id ?? '').toLowerCase()
  const sym = String(m.symbol ?? '').toUpperCase()
  const pct7Raw =
    m.price_change_percentage_7d_in_currency ?? m.price_change_percentage_7d ?? 0
  const pct7 = Number(pct7Raw)
  return {
    price: Number(m.current_price) || 0,
    pct24h: Number(m.price_change_percentage_24h) || 0,
    pct7d: Number.isFinite(pct7) ? pct7 : 0,
    name: String(m.name ?? sym),
    geckoId,
    cmcId: 0,
  }
}

type QuoteOut = ReturnType<typeof rowFromMarket>

function buildPricesPayload(
  geckoIds: string[],
  marketById: Record<string, MarketRow>,
): { prices: Record<string, QuoteOut>; byGeckoId: Record<string, QuoteOut> } {
  const byGeckoId: Record<string, QuoteOut> = {}
  const prices: Record<string, QuoteOut> = {}
  for (const id of geckoIds) {
    const m = marketById[id]
    if (!m) continue
    const row = rowFromMarket(m)
    byGeckoId[id] = row
    const sym = String(m.symbol ?? '').toUpperCase()
    if (sym) prices[sym] = row
  }
  return { prices, byGeckoId }
}

/** Reduz 429: vários clientes / efeitos partilham a mesma resposta durante ~90s. */
const marketsResponseCache = new Map<
  string,
  { at: number; payload: { prices: Record<string, QuoteOut>; byGeckoId: Record<string, QuoteOut> } }
>()
const MARKETS_FRESH_TTL_MS = 90_000
const MARKETS_STALE_ON_429_MS = 4 * 60 * 60 * 1000
const MARKETS_CACHE_MAX_KEYS = 100

function marketsCacheKey(geckoIds: string[]): string {
  return [...geckoIds].sort().join(',')
}

function trimMarketsResponseCache() {
  if (marketsResponseCache.size <= MARKETS_CACHE_MAX_KEYS) return
  const sorted = [...marketsResponseCache.entries()].sort((a, b) => a[1].at - b[1].at)
  const remove = sorted.length - Math.floor(MARKETS_CACHE_MAX_KEYS * 0.75)
  for (let i = 0; i < remove; i++) {
    marketsResponseCache.delete(sorted[i]![0])
  }
}

/** Sem cache: carteira só com stables ainda mostra totais ~corretos quando CG devolve 429. */
const STABLE_GECKO_IDS = new Set([
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

const STABLE_GECKO_META: Record<string, { sym: string; name: string }> = {
  tether: { sym: 'USDT', name: 'Tether' },
  'usd-coin': { sym: 'USDC', name: 'USD Coin' },
  dai: { sym: 'DAI', name: 'Dai' },
  'binance-usd': { sym: 'BUSD', name: 'Binance USD' },
  'true-usd': { sym: 'TUSD', name: 'TrueUSD' },
  'first-digital-usd': { sym: 'FDUSD', name: 'First Digital USD' },
  'paypal-usd': { sym: 'PYUSD', name: 'PayPal USD' },
  'gemini-dollar': { sym: 'GUSD', name: 'Gemini Dollar' },
  'liquity-usd': { sym: 'LUSD', name: 'Liquity USD' },
  usdd: { sym: 'USDD', name: 'USDD' },
}

function syntheticStableOnlyPayload(
  geckoIds: string[],
): { prices: Record<string, QuoteOut>; byGeckoId: Record<string, QuoteOut> } | null {
  const ids = [...new Set(geckoIds)]
  if (!ids.length || !ids.every((id) => STABLE_GECKO_IDS.has(id))) return null
  const prices: Record<string, QuoteOut> = {}
  const byGeckoId: Record<string, QuoteOut> = {}
  for (const id of ids) {
    const meta = STABLE_GECKO_META[id] ?? { sym: id.toUpperCase().slice(0, 12), name: id }
    const row: QuoteOut = {
      price: 1,
      pct24h: 0,
      pct7d: 0,
      name: meta.name,
      geckoId: id,
      cmcId: 0,
    }
    byGeckoId[id] = row
    prices[meta.sym] = row
  }
  return { prices, byGeckoId }
}

async function fetchMarketsForIds(
  geckoIds: string[],
): Promise<{ prices: Record<string, MarketRow> } | { error: string; status: number }> {
  if (!geckoIds.length) return { prices: {} }
  const { base, headers } = getCoingeckoRequestParts()
  const chunkSize = 120
  const merged: MarketRow[] = []
  for (let i = 0; i < geckoIds.length; i += chunkSize) {
    const chunk = geckoIds.slice(i, i + chunkSize)
    const url = `${base}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(chunk.join(','))}&price_change_percentage=24h,7d&per_page=250&page=1`
    const res = await fetch(url, { headers, cache: 'no-store' })
    if (!res.ok) {
      return { error: `coingecko_${res.status}`, status: res.status === 429 ? 429 : 502 }
    }
    const batch = (await res.json()) as MarketRow[]
    if (Array.isArray(batch)) merged.push(...batch)
  }
  const prices: Record<string, MarketRow> = {}
  for (const m of merged) {
    const id = String(m.id ?? '').toLowerCase()
    if (id) prices[id] = m
  }
  return { prices }
}

/**
 * Preços CoinGecko (servidor). Sem chave usa API pública (limites mais baixos).
 * GET /api/prices?ids=bitcoin,solana — ids internos CoinGecko
 * GET /api/prices?symbols=BTC,SOL — resolve via /coins/list em cache
 */
export async function GET(req: NextRequest) {
  const rawIds = req.nextUrl.searchParams.get('ids') ?? ''
  const symbols = parseSymbols(req.nextUrl.searchParams.get('symbols') ?? '')
  let geckoIds = parseGeckoIds(rawIds)

  if (symbols.length) {
    const resolved = await symbolsToGeckoIds(symbols)
    geckoIds = [...new Set([...geckoIds, ...resolved])]
  }

  if (!geckoIds.length) {
    return NextResponse.json({ prices: {}, error: 'missing_symbols_or_ids' }, { status: 400 })
  }

  const key = marketsCacheKey(geckoIds)
  const now = Date.now()
  const hit = marketsResponseCache.get(key)
  if (hit && now - hit.at < MARKETS_FRESH_TTL_MS) {
    return NextResponse.json(hit.payload)
  }

  const result = await fetchMarketsForIds(geckoIds)
  if ('error' in result) {
    if (result.status === 429 && hit && now - hit.at <= MARKETS_STALE_ON_429_MS) {
      return NextResponse.json({ ...hit.payload, stale: true })
    }
    if (result.status === 429) {
      const syn = syntheticStableOnlyPayload(geckoIds)
      if (syn) {
        marketsResponseCache.set(key, { at: now, payload: syn })
        trimMarketsResponseCache()
        return NextResponse.json({ ...syn, approximate: true })
      }
    }
    return NextResponse.json(
      { prices: {}, error: result.error },
      { status: result.status },
    )
  }

  const payload = buildPricesPayload(geckoIds, result.prices)
  marketsResponseCache.set(key, { at: now, payload })
  trimMarketsResponseCache()

  return NextResponse.json(payload)
}
