import { NextRequest, NextResponse } from 'next/server'

const ALLOWED = new Set(['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'])

/** Vision first: often more reliable from US/cloud IPs than api.binance.com */
const BINANCE_KLINE_BASES = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
] as const

export const dynamic = 'force-dynamic'

function buildPath(interval: string, limit: number) {
  const q = new URLSearchParams({
    symbol: 'BTCUSDT',
    interval,
    limit: String(limit),
  })
  return `/api/v3/klines?${q}`
}

async function fetchKlinesArray(
  interval: string,
  limit: number
): Promise<{ data: unknown[] } | { error: string }> {
  const path = buildPath(interval, limit)
  const headers: HeadersInit = {
    Accept: 'application/json',
    'User-Agent': 'YieldScan/1.0 (+https://github.com/aupontocortes-tech/YieldScan)',
  }

  let lastError = 'All Binance endpoints failed'

  for (const base of BINANCE_KLINE_BASES) {
    const url = `${base}${path}`
    try {
      const res = await fetch(url, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      })

      const text = await res.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text) as unknown
      } catch {
        lastError = `Invalid JSON from ${base}`
        continue
      }

      if (!res.ok) {
        const msg =
          typeof parsed === 'object' && parsed !== null && 'msg' in parsed
            ? String((parsed as { msg?: string }).msg)
            : `HTTP ${res.status}`
        lastError = `${base}: ${msg}`
        continue
      }

      if (!Array.isArray(parsed)) {
        lastError = `${base}: response was not klines array`
        continue
      }

      if (parsed.length === 0) {
        lastError = `${base}: empty klines`
        continue
      }

      return { data: parsed }
    } catch (e) {
      lastError = e instanceof Error ? `${base}: ${e.message}` : `${base}: fetch error`
    }
  }

  return { error: lastError }
}

export async function GET(req: NextRequest) {
  const interval = req.nextUrl.searchParams.get('interval') ?? '1h'
  if (!ALLOWED.has(interval)) {
    return NextResponse.json({ error: 'Invalid interval' }, { status: 400 })
  }
  const limit = Math.min(1000, Math.max(50, Number(req.nextUrl.searchParams.get('limit')) || 500))

  const result = await fetchKlinesArray(interval, limit)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  return NextResponse.json(result.data, {
    headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
  })
}
