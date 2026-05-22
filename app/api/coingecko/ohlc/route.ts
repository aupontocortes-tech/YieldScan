import { NextRequest, NextResponse } from 'next/server'
import { getCoingeckoRequestParts } from '@/lib/coingecko-server'

const ALLOWED_DAYS = new Set([1, 7, 14, 30, 90, 180, 365])

/**
 * Proxy CoinGecko coins/{id}/ohlc — velas em USD para RWAs e ativos sem par Binance.
 */
export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get('id') ?? '').replace(/[^a-z0-9_-]/gi, '')
  const daysNum = Number(req.nextUrl.searchParams.get('days') ?? '30')
  const days = ALLOWED_DAYS.has(daysNum) ? daysNum : 30

  if (!id) {
    return NextResponse.json({ error: 'id obrigatório (slug CoinGecko)' }, { status: 400 })
  }

  const { base, headers } = getCoingeckoRequestParts()
  const url = `${base}/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${days}`

  try {
    const res = await fetch(url, {
      headers,
      next: { revalidate: 0 },
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `CoinGecko ${res.status}` },
        { status: res.status === 429 ? 429 : 502 },
      )
    }
    const data = (await res.json()) as unknown
    const ohlc = Array.isArray(data) ? data : []
    return NextResponse.json(
      { ohlc, id, days },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
    )
  } catch {
    return NextResponse.json({ error: 'Falha ao contactar CoinGecko' }, { status: 502 })
  }
}
