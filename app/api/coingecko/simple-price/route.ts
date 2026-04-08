import { NextRequest, NextResponse } from 'next/server'

const IDS_DEFAULT = 'bitcoin,ethereum,solana,tether'
const VS_DEFAULT = 'usd,brl'

/**
 * Proxy para CoinGecko simple/price (evita CORS no browser; um único pedido para vários ids).
 */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get('ids') ?? IDS_DEFAULT).replace(/[^a-z0-9,_-]/gi, '')
  const vs = (req.nextUrl.searchParams.get('vs') ?? VS_DEFAULT).replace(/[^a-z0-9,]/gi, '')
  if (!ids || !vs) {
    return NextResponse.json({ error: 'ids e vs obrigatórios' }, { status: 400 })
  }

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}`

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `CoinGecko ${res.status}` },
        { status: res.status === 429 ? 429 : 502 }
      )
    }
    const data = (await res.json()) as Record<string, Record<string, number>>
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Falha ao contactar CoinGecko' }, { status: 502 })
  }
}
