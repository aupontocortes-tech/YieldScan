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

  const result = await fetchMarketsForIds(geckoIds)
  if ('error' in result) {
    return NextResponse.json(
      { prices: {}, error: result.error },
      { status: result.status },
    )
  }

  const byGeckoId: Record<
    string,
    {
      price: number
      pct24h: number
      pct7d: number
      name: string
      geckoId: string
      cmcId: number
    }
  > = {}
  const prices: Record<
    string,
    {
      price: number
      pct24h: number
      pct7d: number
      name: string
      geckoId: string
      cmcId: number
    }
  > = {}

  for (const id of geckoIds) {
    const m = result.prices[id]
    if (!m) continue
    const row = rowFromMarket(m)
    byGeckoId[id] = row
    const sym = String(m.symbol ?? '').toUpperCase()
    if (sym) prices[sym] = row
  }

  return NextResponse.json({ prices, byGeckoId })
}
