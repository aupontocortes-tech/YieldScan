import { NextResponse } from 'next/server'

/**
 * Lista CoinGecko `simple/supported_vs_currencies` (cache 1h).
 */
export async function GET() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/supported_vs_currencies', {
      headers: { Accept: 'application/json' },
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
