import { NextRequest, NextResponse } from 'next/server'
import { fetchCoingecko, isCoingeckoAuthError, isCoingeckoRateLimit } from '@/lib/coingecko-server'

const ALLOWED_DAYS = new Set([1, 7, 14, 30, 90, 180, 365, 'max'])

type CacheEntry = { at: number; ohlc: unknown[] }

const ohlcCache = new Map<string, CacheEntry>()
const OHLC_FRESH_MS = 120_000
const OHLC_STALE_ON_ERROR_MS = 6 * 60 * 60 * 1000

function cacheKey(id: string, days: string | number): string {
  return `${id}:${days}`
}

function freshTtlMs(days: string | number): number {
  if (days === 'max') return 600_000
  if (days === 1) return 60_000
  return OHLC_FRESH_MS
}

/**
 * Proxy CoinGecko coins/{id}/ohlc — velas em USD para RWAs e ativos sem par Binance.
 * Cache em memória + stale-on-429 para reduzir falhas no mobile.
 */
export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get('id') ?? '').replace(/[^a-z0-9_-]/gi, '')
  const daysRaw = (req.nextUrl.searchParams.get('days') ?? '30').toLowerCase()
  const daysNum = Number(daysRaw)
  const days: number | 'max' =
    daysRaw === 'max'
      ? 'max'
      : ALLOWED_DAYS.has(daysNum)
        ? daysNum
        : 30

  if (!id) {
    return NextResponse.json({ error: 'id obrigatório (slug CoinGecko)' }, { status: 400 })
  }

  const key = cacheKey(id, days)
  const now = Date.now()
  const hit = ohlcCache.get(key)
  if (hit && now - hit.at <= freshTtlMs(days)) {
    return NextResponse.json(
      { ohlc: hit.ohlc, id, days, cached: true },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${Math.floor(freshTtlMs(days) / 1000)}, stale-while-revalidate=120`,
        },
      },
    )
  }

  const path = `/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${days}`

  try {
    const res = await fetchCoingecko(path, { next: { revalidate: 0 } })

    if (!res.ok) {
      const useStale =
        hit &&
        now - hit.at <= OHLC_STALE_ON_ERROR_MS &&
        (isCoingeckoRateLimit(res.status) || isCoingeckoAuthError(res.status))
      if (useStale) {
        return NextResponse.json(
          { ohlc: hit.ohlc, id, days, stale: true },
          {
            headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
          },
        )
      }
      if (isCoingeckoRateLimit(res.status)) {
        return NextResponse.json(
          { ohlc: [], id, days, error: 'rate_limit' },
          { status: 200, headers: { 'Cache-Control': 'public, s-maxage=30' } },
        )
      }
      return NextResponse.json(
        { error: `CoinGecko ${res.status}` },
        { status: 502 },
      )
    }

    const data = (await res.json()) as unknown
    const ohlc = Array.isArray(data) ? data : []
    ohlcCache.set(key, { at: now, ohlc })

    const cacheSec = days === 'max' ? 600 : 60
    return NextResponse.json(
      { ohlc, id, days },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${cacheSec}, stale-while-revalidate=${cacheSec * 2}`,
        },
      },
    )
  } catch {
    if (hit && now - hit.at <= OHLC_STALE_ON_ERROR_MS) {
      return NextResponse.json(
        { ohlc: hit.ohlc, id, days, stale: true },
        { headers: { 'Cache-Control': 'public, s-maxage=60' } },
      )
    }
    return NextResponse.json({ error: 'Falha ao contactar CoinGecko' }, { status: 502 })
  }
}
