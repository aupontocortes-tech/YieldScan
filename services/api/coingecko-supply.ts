import { getCoingeckoRequestParts } from '@/lib/coingecko-server'

export type CoingeckoMarketRow = {
  id: string
  symbol: string
  name: string
  image: string | null
  current_price: number | null
  market_cap: number | null
  circulating_supply: number | null
  total_supply: number | null
  max_supply: number | null
}

/** Top coins por market cap (fallback quando DefiLlama emissions não está disponível). */
export async function fetchCoingeckoTopMarkets(limit = 150): Promise<CoingeckoMarketRow[]> {
  const { base, headers } = getCoingeckoRequestParts()
  const perPage = 100
  const pages = Math.min(3, Math.ceil(Math.min(limit, 250) / perPage))
  const all: CoingeckoMarketRow[] = []

  for (let page = 1; page <= pages; page++) {
    const url = `${base}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false`
    const res = await fetch(url, {
      headers,
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) break
    const rows = (await res.json()) as CoingeckoMarketRow[]
    if (!Array.isArray(rows) || rows.length === 0) break
    all.push(...rows)
    if (all.length >= limit) break
  }

  return all.slice(0, limit)
}

export async function fetchCoingeckoMarketsByIds(ids: string[]): Promise<CoingeckoMarketRow[]> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return []

  const { base, headers } = getCoingeckoRequestParts()
  const chunkSize = 200
  const all: CoingeckoMarketRow[] = []

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const url = `${base}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(chunk.join(','))}&order=market_cap_desc&per_page=${chunk.length}&page=1&sparkline=false`
    const res = await fetch(url, {
      headers,
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) continue
    const rows = (await res.json()) as CoingeckoMarketRow[]
    if (Array.isArray(rows)) all.push(...rows)
  }

  return all
}

export async function fetchCoingeckoCirculatingChart(
  geckoId: string,
  days: number
): Promise<[number, number][]> {
  const { base, headers } = getCoingeckoRequestParts()
  const d = days >= 365 ? 'max' : String(Math.min(365, Math.max(1, days)))
  const url = `${base}/coins/${encodeURIComponent(geckoId)}/circulating_supply_chart?days=${d}`

  const res = await fetch(url, {
    headers,
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(25_000),
  })

  if (!res.ok) return []

  const body = (await res.json()) as {
    circulating_supply?: [number, number][]
  }
  return body.circulating_supply ?? []
}
