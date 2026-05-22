/** Lógica partilhada entre rotas API de klines (Binance). */

const ALLOWED = new Set(['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'])

const BINANCE_KLINE_BASES = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
] as const

function buildPath(symbol: string, interval: string, limit: number) {
  const q = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval,
    limit: String(limit),
  })
  return `/api/v3/klines?${q}`
}

export async function fetchBinanceKlinesArray(
  interval: string,
  limit: number,
  symbol = 'BTCUSDT',
): Promise<{ data: unknown[] } | { error: string }> {
  if (!ALLOWED.has(interval)) {
    return { error: 'Invalid interval' }
  }

  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (sym.length < 6 || sym.length > 24) {
    return { error: 'Invalid symbol' }
  }

  const path = buildPath(sym, interval, limit)
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
