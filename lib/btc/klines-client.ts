import type { IndicatorPair } from '@/lib/btc/indicator-pairs'
import type { BinanceInterval, OhlcvBar, TimeframePreset } from '@/lib/btc/types'
import { parseBinanceKlines } from '@/lib/btc/binance'

/** Slug CoinGecko → par Binance equivalente (fallback quando CG limita pedidos). */
const COINGECKO_BINANCE_FALLBACK: Record<string, string> = {
  bitcoin: 'BTCUSDT',
  ethereum: 'ETHUSDT',
  solana: 'SOLUSDT',
  binancecoin: 'BNBUSDT',
  ripple: 'XRPUSDT',
  cardano: 'ADAUSDT',
  chainlink: 'LINKUSDT',
  'avalanche-2': 'AVAXUSDT',
  dogecoin: 'DOGEUSDT',
  polkadot: 'DOTUSDT',
  litecoin: 'LTCUSDT',
  tron: 'TRXUSDT',
  cosmos: 'ATOMUSDT',
  near: 'NEARUSDT',
  arbitrum: 'ARBUSDT',
  optimism: 'OPUSDT',
  sui: 'SUIUSDT',
  aptos: 'APTUSDT',
  'injective-protocol': 'INJUSDT',
  pepe: 'PEPEUSDT',
  shiba: 'SHIBUSDT',
  dogwifcoin: 'WIFUSDT',
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

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
  let lastErr = 'CoinGecko indisponível'

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(600 * attempt)
    const res = await fetch(
      `/api/coingecko/ohlc?id=${encodeURIComponent(id)}&days=${days}`,
      { cache: 'no-store' },
    )
    const body = (await res.json()) as { ohlc?: unknown[]; error?: string; stale?: boolean }
    if (res.ok && Array.isArray(body.ohlc) && body.ohlc.length > 0) {
      return parseCoingeckoOhlc(body.ohlc)
    }
    lastErr = body.error ?? `CoinGecko OHLC (${res.status})`
    if (body.error === 'rate_limit' || res.status === 429) break
    if (res.status !== 429) break
  }

  throw new Error(lastErr)
}

function tryBinanceFallback(
  coingeckoId: string,
  timeframe: TimeframePreset,
  limit: number,
): Promise<OhlcvBar[]> | null {
  const sym = COINGECKO_BINANCE_FALLBACK[coingeckoId.trim().toLowerCase()]
  if (!sym) return null
  return fetchBinancePairKlines(sym, timeframe.interval, limit)
}

function tryBinanceFallbackByInterval(
  coingeckoId: string,
  interval: BinanceInterval,
  limit: number,
): Promise<OhlcvBar[]> | null {
  const sym = COINGECKO_BINANCE_FALLBACK[coingeckoId.trim().toLowerCase()]
  if (!sym) return null
  return fetchBinancePairKlines(sym, interval, limit)
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
    const fb = tryBinanceFallback(pair.coingeckoId, timeframe, limit)
    if (fb) {
      try {
        const bars = await fb
        if (bars.length > 0) {
          if (limit > 0 && bars.length > limit) return bars.slice(-limit)
          return bars
        }
      } catch {
        /* tenta CoinGecko */
      }
    }
    const days = coingeckoOhlcDaysForTimeframe(timeframe)
    try {
      const bars = await fetchCoingeckoPairOhlc(pair.coingeckoId, days)
      if (limit > 0 && bars.length > limit) return bars.slice(-limit)
      return bars
    } catch (err) {
      if (fb) {
        try {
          return await fb
        } catch {
          /* mantém erro original */
        }
      }
      throw err
    }
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
    try {
      const bars = await fetchCoingeckoPairOhlc(pair.coingeckoId, days)
      return !fullHistory && bars.length > limit ? bars.slice(-limit) : bars
    } catch {
      const fb = tryBinanceFallbackByInterval(pair.coingeckoId, interval, fullHistory ? 0 : limit)
      if (fb) return fb
      return []
    }
  }
  return []
}

/** @deprecated Use fetchBinancePairKlines('BTCUSDT', …) */
export async function fetchBtcKlines(interval: BinanceInterval, limit = 500): Promise<OhlcvBar[]> {
  return fetchBinancePairKlines('BTCUSDT', interval, limit)
}
