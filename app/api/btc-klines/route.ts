import { NextRequest, NextResponse } from 'next/server'

const ALLOWED = new Set(['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'])

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const interval = req.nextUrl.searchParams.get('interval') ?? '1h'
  if (!ALLOWED.has(interval)) {
    return NextResponse.json({ error: 'Invalid interval' }, { status: 400 })
  }
  const limit = Math.min(1000, Math.max(50, Number(req.nextUrl.searchParams.get('limit')) || 500))
  const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Binance error' }, { status: 502 })
    }
    const data = await res.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    })
  } catch {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })
  }
}
