import { NextRequest, NextResponse } from 'next/server'
import { fetchCoingecko } from '@/lib/coingecko-server'

/**
 * Proxy para CoinGecko coins/{id}/market_chart (preços históricos vs USD).
 */
export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get('id') ?? '').replace(/[^a-z0-9_-]/gi, '')
  const daysRaw = req.nextUrl.searchParams.get('days') ?? '1'
  const days = daysRaw === '7' ? '7' : '1'
  if (!id) {
    return NextResponse.json({ error: 'id obrigatório (CoinGecko coin id)' }, { status: 400 })
  }

  const path = `/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`

  try {
    const res = await fetchCoingecko(path, { next: { revalidate: 0 } })
    if (!res.ok) {
      return NextResponse.json(
        { error: `CoinGecko ${res.status}` },
        { status: res.status === 429 ? 429 : 502 },
      )
    }
    const data = (await res.json()) as { prices?: [number, number][] }
    return NextResponse.json({ prices: data.prices ?? [] })
  } catch {
    return NextResponse.json({ error: 'Falha ao contactar CoinGecko' }, { status: 502 })
  }
}
