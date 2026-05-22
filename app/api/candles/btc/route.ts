/**
 * Alias de `/api/btc-klines` — alguns ambientes/proxies falham com o segmento `btc-klines`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { fetchBinanceKlinesArray } from '@/lib/btc/fetch-binance-klines-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const interval = req.nextUrl.searchParams.get('interval') ?? '1h'
  const limit = Math.min(1000, Math.max(50, Number(req.nextUrl.searchParams.get('limit')) || 500))
  const symbol = (req.nextUrl.searchParams.get('symbol') ?? 'BTCUSDT').toUpperCase()

  const result = await fetchBinanceKlinesArray(interval, limit, symbol)
  if ('error' in result) {
    const status = result.error === 'Invalid interval' ? 400 : 502
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(result.data, {
    headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
  })
}
