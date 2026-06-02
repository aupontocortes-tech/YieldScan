import { NextRequest, NextResponse } from 'next/server'
import { getCoingeckoRequestParts } from '@/lib/coingecko-server'

/**
 * Logos CoinGecko por slug (coins/markets) — até 12 ids por pedido.
 */
export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get('ids') ?? '').trim()
  const ids = [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[a-z0-9][a-z0-9_-]{0,47}$/.test(s)),
    ),
  ].slice(0, 12)

  if (!ids.length) {
    return NextResponse.json({ icons: {} as Record<string, string> })
  }

  const { base, headers } = getCoingeckoRequestParts()
  const url = `${base}/coins/markets?vs_currency=usd&ids=${ids.map(encodeURIComponent).join(',')}&order=market_cap_desc&per_page=${ids.length}&page=1&sparkline=false`

  try {
    const res = await fetch(url, { headers, next: { revalidate: 3600 } })
    if (!res.ok) {
      return NextResponse.json({ icons: {} }, { status: res.status === 429 ? 429 : 502 })
    }
    const rows = (await res.json()) as Array<{ id?: string; image?: string }>
    const icons: Record<string, string> = {}
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const id = String(row.id ?? '').trim().toLowerCase()
        const image = typeof row.image === 'string' ? row.image.trim() : ''
        if (id && image.startsWith('https://')) icons[id] = image
      }
    }
    return NextResponse.json({ icons })
  } catch {
    return NextResponse.json({ icons: {} }, { status: 502 })
  }
}
