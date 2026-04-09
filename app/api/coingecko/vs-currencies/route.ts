import { NextResponse } from 'next/server'
import { getCoingeckoRequestParts } from '@/lib/coingecko-server'

/**
 * Lista CoinGecko `simple/supported_vs_currencies` (cache 1h).
 */
export async function GET() {
  try {
    const { base, headers } = getCoingeckoRequestParts()
    const res = await fetch(`${base}/simple/supported_vs_currencies`, {
      headers,
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      return NextResponse.json(
        { currencies: ['usd', 'brl', 'eur'] },
        { status: 200, headers: { 'X-Fallback': '1' } }
      )
    }
    const list = (await res.json()) as unknown
    const currencies = Array.isArray(list)
      ? list.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
      : []
    return NextResponse.json({ currencies })
  } catch {
    return NextResponse.json({ currencies: ['usd', 'brl', 'eur'] })
  }
}
