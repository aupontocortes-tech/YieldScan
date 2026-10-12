import type { HlBar, HlSymbol, HlTimeframe } from '@/lib/hyperliquid/types'

const INFO_URL = 'https://api.hyperliquid.xyz/info'

const INTERVAL: Record<HlTimeframe, string> = {
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
}

const STEP_MS: Record<HlTimeframe, number> = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
}

type CandleRow = {
  t: number
  o: string
  h: string
  l: string
  c: string
  v: string
}

type AssetCtx = {
  oraclePx?: string
  markPx?: string
  midPx?: string
}

export type HyperliquidMarket = {
  symbol: HlSymbol
  interval: HlTimeframe
  source: 'hyperliquid'
  bars: HlBar[]
  oraclePx: number | null
  markPx: number | null
  midPx: number | null
}

async function info<T>(body: unknown): Promise<T> {
  const res = await fetch(INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Hyperliquid info ${res.status}`)
  return (await res.json()) as T
}

function parseBars(rows: CandleRow[]): HlBar[] {
  return rows
    .map((row) => ({
      time: Math.floor(Number(row.t) / 1000),
      open: Number(row.o),
      high: Number(row.h),
      low: Number(row.l),
      close: Number(row.c),
      volume: Number(row.v),
    }))
    .filter((bar) => Number.isFinite(bar.time) && Number.isFinite(bar.close) && bar.close > 0)
    .sort((a, b) => a.time - b.time)
}

export async function fetchHyperliquidMarket(symbol: HlSymbol, interval: HlTimeframe, bars = 200): Promise<HyperliquidMarket> {
  const end = Date.now()
  const start = end - STEP_MS[interval] * bars
  const [candles, meta] = await Promise.all([
    info<CandleRow[]>({
      type: 'candleSnapshot',
      req: { coin: symbol, interval: INTERVAL[interval], startTime: start, endTime: end },
    }),
    info<[{ universe: { name: string }[] }, AssetCtx[]]>({ type: 'metaAndAssetCtxs' }),
  ])
  const names = meta[0]?.universe ?? []
  const ctxs = meta[1] ?? []
  const index = names.findIndex((asset) => asset.name === symbol)
  const ctx = index >= 0 ? ctxs[index] : undefined
  const num = (value?: string) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return {
    symbol,
    interval,
    source: 'hyperliquid',
    bars: parseBars(Array.isArray(candles) ? candles : []).slice(-bars),
    oraclePx: num(ctx?.oraclePx),
    markPx: num(ctx?.markPx),
    midPx: num(ctx?.midPx),
  }
}
