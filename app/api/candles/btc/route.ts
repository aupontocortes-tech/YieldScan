/**
 * Alias de `/api/btc-klines` — alguns ambientes/proxies falham com o segmento `btc-klines`.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  fetchBinanceKlinesArray,
  isFullHistoryKlinesLimit,
} from '@/lib/btc/fetch-binance-klines-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const interval = req.nextUrl.searchParams.get('interval') ?? '1h'
  const limitRaw = req.nextUrl.searchParams.get('limit')
  const limitNum = Number(limitRaw)
  const limit = isFullHistoryKlinesLimit(limitNum)
    ? 0
    : Math.min(1000, Math.max(50, limitNum || 500))
  const symbol = (req.nextUrl.searchParams.get('symbol') ?? 'BTCUSDT').toUpperCase()

  const result = await fetchBinanceKlinesArray(interval, limit, symbol)
  if ('error' in result) {
    const status =
      result.error === 'Invalid interval' || result.error === 'Invalid symbol' ? 400 : 502
    return NextResponse.json({ error: result.error }, { status })
  }

  const cacheSec = limit === 0 ? 300 : 15
  return NextResponse.json(result.data, {
    headers: {
      'Cache-Control': `public, s-maxage=${cacheSec}, stale-while-revalidate=${cacheSec * 2}`,
    },
  })
}
