/** Lógica partilhada entre rotas API de klines (Binance). */

const ALLOWED = new Set(['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'])

const BINANCE_KLINE_BASES = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
] as const

export const BINANCE_KLINE_PAGE_SIZE = 1000

/** Máximo de velas ao pedir histórico completo (limit=0 no cliente). */
export const BINANCE_FULL_HISTORY_MAX_BARS = 12_000

const FULL_HISTORY_MAX_PAGES = 16

const HEADERS: HeadersInit = {
  Accept: 'application/json',
  'User-Agent': 'YieldScan/1.0 (+https://github.com/aupontocortes-tech/YieldScan)',
}

export function isFullHistoryKlinesLimit(limit: number): boolean {
  return !Number.isFinite(limit) || limit <= 0
}

function buildPath(symbol: string, interval: string, limit: number, endTime?: number) {
  const q = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval,
    limit: String(Math.min(BINANCE_KLINE_PAGE_SIZE, Math.max(1, limit))),
  })
  if (endTime != null && Number.isFinite(endTime)) {
    q.set('endTime', String(Math.floor(endTime)))
  }
  return `/api/v3/klines?${q}`
}

function normalizeSymbol(symbol: string): string | { error: string } {
  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (sym.length < 6 || sym.length > 24) return { error: 'Invalid symbol' }
  return sym
}

async function fetchKlinesPage(
  sym: string,
  interval: string,
  limit: number,
  endTime?: number,
): Promise<{ data: unknown[] } | { error: string }> {
  const path = buildPath(sym, interval, limit, endTime)
  let lastError = 'All Binance endpoints failed'

  for (const base of BINANCE_KLINE_BASES) {
    const url = `${base}${path}`
    try {
      const res = await fetch(url, {
        headers: HEADERS,
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
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

      return { data: parsed }
    } catch (e) {
      lastError = e instanceof Error ? `${base}: ${e.message}` : `${base}: fetch error`
    }
  }

  return { error: lastError }
}

function klineOpenTimeMs(row: unknown): number | null {
  if (!Array.isArray(row) || row.length < 1) return null
  const t = Number(row[0])
  return Number.isFinite(t) ? t : null
}

/** Pagina para trás até ao primeiro dia listado na Binance (ou atingir maxBars). */
export async function fetchBinanceKlinesArrayFull(
  interval: string,
  symbol = 'BTCUSDT',
  maxBars = BINANCE_FULL_HISTORY_MAX_BARS,
): Promise<{ data: unknown[] } | { error: string }> {
  if (!ALLOWED.has(interval)) {
    return { error: 'Invalid interval' }
  }

  const sym = normalizeSymbol(symbol)
  if (typeof sym !== 'string') return sym

  const merged: unknown[] = []
  let endTime: number | undefined

  for (let page = 0; page < FULL_HISTORY_MAX_PAGES; page++) {
    const remaining = maxBars - merged.length
    if (remaining <= 0) break

    const pageLimit = Math.min(BINANCE_KLINE_PAGE_SIZE, remaining)
    const result = await fetchKlinesPage(sym, interval, pageLimit, endTime)
    if ('error' in result) {
      return merged.length > 0 ? { data: merged } : result
    }

    const batch = result.data
    if (batch.length === 0) break

    merged.unshift(...batch)
    if (batch.length < pageLimit) break

    const oldest = klineOpenTimeMs(batch[0])
    if (oldest == null) break
    endTime = oldest - 1
  }

  if (merged.length === 0) {
    return { error: 'No klines returned' }
  }

  const seen = new Set<number>()
  const deduped: unknown[] = []
  for (const row of merged) {
    const t = klineOpenTimeMs(row)
    if (t == null || seen.has(t)) continue
    seen.add(t)
    deduped.push(row)
  }

  deduped.sort((a, b) => (klineOpenTimeMs(a) ?? 0) - (klineOpenTimeMs(b) ?? 0))

  return { data: deduped }
}

export async function fetchBinanceKlinesArray(
  interval: string,
  limit: number,
  symbol = 'BTCUSDT',
): Promise<{ data: unknown[] } | { error: string }> {
  if (!ALLOWED.has(interval)) {
    return { error: 'Invalid interval' }
  }

  const sym = normalizeSymbol(symbol)
  if (typeof sym !== 'string') return sym

  if (isFullHistoryKlinesLimit(limit)) {
    return fetchBinanceKlinesArrayFull(interval, sym)
  }

  const result = await fetchKlinesPage(sym, interval, Math.min(BINANCE_KLINE_PAGE_SIZE, limit))
  if ('error' in result) return result
  if (result.data.length === 0) {
    return { error: 'empty klines' }
  }
  return result
}
