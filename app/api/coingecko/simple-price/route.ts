import { NextRequest, NextResponse } from 'next/server'
import { fetchCoingeckoSimplePrices } from '@/lib/coingecko-simple-price-server'

const IDS_DEFAULT = 'bitcoin,ethereum,solana,tether'
const VS_DEFAULT = 'usd,brl'

/**
 * Proxy para CoinGecko simple/price (evita CORS no browser; cache + stale-on-429).
 */
export async function GET(req: NextRequest) {
  const idsRaw = (req.nextUrl.searchParams.get('ids') ?? IDS_DEFAULT).replace(/[^a-z0-9,_-]/gi, '')
  const vs = (req.nextUrl.searchParams.get('vs') ?? VS_DEFAULT).replace(/[^a-z0-9,]/gi, '')
  const ids = idsRaw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (!ids.length || !vs) {
    return NextResponse.json({ error: 'ids e vs obrigatórios' }, { status: 400 })
  }

  const include24 =
    req.nextUrl.searchParams.get('include_24hr_change') === 'true' ||
    req.nextUrl.searchParams.get('include_24hr_change') === '1'

  const result = await fetchCoingeckoSimplePrices(ids, {
    vsCurrencies: vs,
    include24hrChange: include24,
    includeMarketCap: false,
    allowStale: true,
  })

  if (Object.keys(result.data).length === 0 && !result.stale) {
    return NextResponse.json({ error: 'CoinGecko indisponível' }, { status: 502 })
  }

  return NextResponse.json(result.data, {
    headers: {
      'Cache-Control': result.stale
        ? 'public, s-maxage=30, stale-while-revalidate=120'
        : 'public, s-maxage=60, stale-while-revalidate=120',
    },
  })
}
