import { NextRequest, NextResponse } from 'next/server'

export type CoinSearchHit = { id: string; name: string; symbol: string; image?: string }

/**
 * Proxy para CoinGecko /search — autocomplete de moedas.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return NextResponse.json({ coins: [] as CoinSearchHit[] })
  }

  const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q.slice(0, 64))}`

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 120 },
    })
    if (!res.ok) {
      return NextResponse.json(
        { coins: [], error: `CoinGecko ${res.status}` },
        { status: res.status === 429 ? 429 : 502 }
      )
    }
    const data = (await res.json()) as {
      coins?: Array<{ id?: string; name?: string; symbol?: string; thumb?: string; large?: string }>
    }
    const raw = Array.isArray(data.coins) ? data.coins : []
    const coins: CoinSearchHit[] = raw
      .slice(0, 30)
      .map((c) => ({
        id: String(c.id ?? '').trim(),
        name: String(c.name ?? '').trim(),
        symbol: String(c.symbol ?? '').trim(),
        image: c.thumb ?? c.large ?? undefined,
      }))
      .filter((c) => c.id && c.name)
    return NextResponse.json({ coins })
  } catch {
    return NextResponse.json({ coins: [], error: 'network' }, { status: 502 })
  }
}
