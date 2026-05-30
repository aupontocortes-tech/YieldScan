import { getCoingeckoRequestParts } from '@/lib/coingecko-server'
import { COINGECKO_LOGO_BY_ID } from '@/lib/coingecko-static-logos'

export type RawMarketCoin = {
  id: string
  symbol: string
  name: string
  image: string | null
  current_price: number | null
  market_cap: number | null
  total_volume: number | null
  price_change_percentage_24h: number | null
  price_change_percentage_7d_in_currency?: number | null
  price_change_percentage_30d_in_currency?: number | null
  price_change_percentage_200d_in_currency?: number | null
  ath?: number | null
  ath_change_percentage?: number | null
  high_24h?: number | null
}

export type RawGlobal = {
  total_market_cap: { usd?: number }
  total_volume: { usd?: number }
  market_cap_change_percentage_24h_usd?: number
  market_cap_percentage: { btc?: number; eth?: number }
}

export type RawTrending = {
  id: string
  name: string
  symbol: string
  thumb: string | null
  score: number
}

const UA = 'yieldscan-tendencias/1'

async function cgFetch<T>(path: string): Promise<T | null> {
  const { base, headers } = getCoingeckoRequestParts()
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { ...headers, 'User-Agent': UA },
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function fetchTendenciasMarkets(limit = 100): Promise<RawMarketCoin[]> {
  const path = `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${Math.min(limit, 100)}&page=1&sparkline=false&price_change_percentage=24h,7d,30d,200d`
  const rows = await cgFetch<RawMarketCoin[]>(path)
  if (!Array.isArray(rows)) return []
  return rows.map((r) => ({
    ...r,
    image: r.image ?? COINGECKO_LOGO_BY_ID[r.id] ?? null,
  }))
}

export async function fetchTendenciasGlobal(): Promise<RawGlobal | null> {
  const wrapped = await cgFetch<{ data?: RawGlobal }>('/global')
  return wrapped?.data ?? null
}

export async function fetchTendenciasTrending(): Promise<RawTrending[]> {
  const data = await cgFetch<{ coins?: Array<{ item?: Record<string, unknown> }> }>('/search/trending')
  if (!data?.coins?.length) return []
  return data.coins
    .map((c, i) => {
      const item = c.item ?? {}
      const id = String(item.id ?? '')
      if (!id) return null
      return {
        id,
        name: String(item.name ?? id),
        symbol: String(item.symbol ?? '').toUpperCase(),
        thumb: (item.thumb as string) ?? COINGECKO_LOGO_BY_ID[id] ?? null,
        score: data.coins!.length - i,
      }
    })
    .filter((x): x is RawTrending => x != null)
}
