import type { IndicatorPair } from '@/lib/btc/indicator-pairs'
import type { BinanceInterval, OhlcvBar, TimeframePreset } from '@/lib/btc/types'
import { parseBinanceKlines } from '@/lib/btc/binance'

async function fetchKlinesFromApi(
  path: string,
  params: Record<string, string>,
): Promise<{ ok: boolean; body: unknown; status: number }> {
  const q = new URLSearchParams(params)
  const res = await fetch(`${path}?${q}`, { cache: 'no-store', credentials: 'same-origin' })
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { ok: res.ok, body, status: res.status }
}

function errorMessageFromResponse(body: unknown, status: number, path: string): string {
  if (status === 404) return `Rota ${path} não encontrada (404).`
  const msg =
    body &&
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'string'
      ? (body as { error: string }).error
      : `Pedido falhou (${status})`
  return msg
}

/** 0 = pedir histórico completo (paginação Binance até ao primeiro dia listado). */
export function resolveIndicatorKlinesLimit(timeframe: TimeframePreset): number {
  if (timeframe.id === '1d' || timeframe.id === '1w' || timeframe.id === '1M') return 0
  return Math.min(timeframe.limit, 1000)
}

export async function fetchBinancePairKlines(
  symbol: string,
  interval: BinanceInterval,
  limit = 500,
): Promise<OhlcvBar[]> {
  const sym = symbol.toUpperCase()
  const bases = ['/api/btc-klines', '/api/candles/btc']
  let lastErr = 'Sem resposta do servidor'
  const limitParam = limit <= 0 ? '0' : String(Math.min(1000, limit))

  for (const path of bases) {
    const { ok, body, status } = await fetchKlinesFromApi(path, {
      symbol: sym,
      interval,
      limit: limitParam,
    })
    if (ok && Array.isArray(body)) {
      return parseBinanceKlines(body)
    }
    lastErr = errorMessageFromResponse(body, status, path)
  }

  throw new Error(lastErr)
}

/** Dias aceites pela API OHLC CoinGecko (`max` = desde o início do ativo). */
export type CoingeckoOhlcDays = 1 | 7 | 14 | 30 | 90 | 180 | 365 | 'max'

export function coingeckoOhlcDaysForTimeframe(tf: TimeframePreset): CoingeckoOhlcDays {
  if (tf.group === 'intra') return 1
  if (tf.id === '1d' || tf.id === '1w' || tf.id === '1M') return 'max'
  if (tf.id === '2mo' || tf.id === '3mo') return 30
  if (tf.id === '6mo') return 90
  if (tf.id === '1y' || tf.id === '3y') return 365
  return 30
}

export function parseCoingeckoOhlc(raw: unknown[]): OhlcvBar[] {
  return raw
    .map((row) => {
      if (!Array.isArray(row) || row.length < 5) return null
      const t = Number(row[0])
      if (!Number.isFinite(t)) return null
      const open = Number(row[1])
      const high = Number(row[2])
      const low = Number(row[3])
      const close = Number(row[4])
      if (![open, high, low, close].every(Number.isFinite)) return null
      return {
        time: Math.floor(t / 1000),
        open,
        high,
        low,
        close,
        volume: 0,
      }
    })
    .filter((b): b is OhlcvBar => b != null)
}

export async function fetchCoingeckoPairOhlc(
  coingeckoId: string,
  days: CoingeckoOhlcDays,
): Promise<OhlcvBar[]> {
  const id = coingeckoId.trim().toLowerCase()
  const res = await fetch(
    `/api/coingecko/ohlc?id=${encodeURIComponent(id)}&days=${days}`,
    { cache: 'no-store' },
  )
  const body = (await res.json()) as { ohlc?: unknown[]; error?: string }
  if (!res.ok) {
    throw new Error(body.error ?? `CoinGecko OHLC (${res.status})`)
  }
  if (!Array.isArray(body.ohlc)) return []
  return parseCoingeckoOhlc(body.ohlc)
}

export async function fetchIndicatorKlines(
  pair: IndicatorPair,
  timeframe: TimeframePreset,
): Promise<OhlcvBar[]> {
  const limit = resolveIndicatorKlinesLimit(timeframe)
  if (pair.source === 'binance' && pair.binanceSymbol) {
    return fetchBinancePairKlines(pair.binanceSymbol, timeframe.interval, limit)
  }
  if (pair.source === 'coingecko' && pair.coingeckoId) {
    const days = coingeckoOhlcDaysForTimeframe(timeframe)
    const bars = await fetchCoingeckoPairOhlc(pair.coingeckoId, days)
    if (limit > 0 && bars.length > limit) {
      return bars.slice(-limit)
    }
    return bars
  }
  throw new Error('Par sem fonte de dados configurada.')
}

/** Velas auxiliares (SMA 200 diária, banda semanal, etc.). limit ≤ 0 = histórico completo. */
export async function fetchPairKlinesByInterval(
  pair: IndicatorPair,
  interval: BinanceInterval,
  limit: number,
): Promise<OhlcvBar[]> {
  const fullHistory = limit <= 0
  if (pair.source === 'binance' && pair.binanceSymbol) {
    return fetchBinancePairKlines(pair.binanceSymbol, interval, fullHistory ? 0 : limit)
  }
  if (pair.coingeckoId) {
    const days: CoingeckoOhlcDays = fullHistory
      ? 'max'
      : interval === '1w' || interval === '1M'
        ? 365
        : interval === '1d'
          ? 90
          : 30
    const bars = await fetchCoingeckoPairOhlc(pair.coingeckoId, days)
    return !fullHistory && bars.length > limit ? bars.slice(-limit) : bars
  }
  return []
}

/** @deprecated Use fetchBinancePairKlines('BTCUSDT', …) */
export async function fetchBtcKlines(interval: BinanceInterval, limit = 500): Promise<OhlcvBar[]> {
  return fetchBinancePairKlines('BTCUSDT', interval, limit)
}
