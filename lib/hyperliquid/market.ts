import { BASE_PRICE, TIMEFRAMES, VOL_MULT } from '@/lib/hyperliquid/constants'
import type { HlBar, HlSymbol, HlTimeframe, NewsRisk } from '@/lib/hyperliquid/types'

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function timeframeSeconds(tf: HlTimeframe): number {
  return TIMEFRAMES.find((t) => t.id === tf)?.seconds ?? 3600
}

export function generateBars(symbol: HlSymbol, tf: HlTimeframe, count = 180, now = Date.now()): HlBar[] {
  const step = timeframeSeconds(tf)
  const rand = mulberry32(hash(`${symbol}:${tf}:v1`))
  const vol = 0.008 * VOL_MULT[symbol]
  let price = BASE_PRICE[symbol]
  const start = Math.floor(now / 1000) - step * count
  const bars: HlBar[] = []
  for (let i = 0; i < count; i++) {
    const drift = (rand() - 0.48) * vol
    const open = price
    const close = Math.max(0.01, open * (1 + drift))
    const wick = Math.abs(close - open) * (0.4 + rand())
    const high = Math.max(open, close) + wick * rand()
    const low = Math.min(open, close) - wick * rand()
    const volume = (0.4 + rand()) * (symbol === 'BTC' ? 120 : symbol === 'HYPE' ? 8000 : 2000)
    bars.push({
      time: start + i * step,
      open,
      high,
      low: Math.max(0.01, low),
      close,
      volume,
    })
    price = close
  }
  return bars
}

export function appendBar(bars: HlBar[], symbol: HlSymbol, tf: HlTimeframe): HlBar[] {
  const prev = bars[bars.length - 1]
  if (!prev) return generateBars(symbol, tf)
  const rand = mulberry32(hash(`${symbol}:${prev.time}:${prev.close.toFixed(4)}`))
  const vol = 0.007 * VOL_MULT[symbol]
  const open = prev.close
  const close = Math.max(0.01, open * (1 + (rand() - 0.48) * vol))
  const wick = Math.abs(close - open) * (0.5 + rand())
  const bar: HlBar = {
    time: prev.time + timeframeSeconds(tf),
    open,
    high: Math.max(open, close) + wick * rand(),
    low: Math.max(0.01, Math.min(open, close) - wick * rand()),
    close,
    volume: (0.4 + rand()) * (symbol === 'BTC' ? 120 : 2000),
  }
  return [...bars.slice(-240), bar]
}

/** Preço de oráculo simulado (Chainlink/Pyth). Divergência pequena vs o candle. */
export function simulatedOraclePrice(close: number, symbol: HlSymbol, barTime: number): number {
  const rand = mulberry32(hash(`oracle:${symbol}:${barTime}`))
  const delta = (rand() - 0.5) * 0.004
  return close * (1 + delta)
}

const NEWS = [
  { risk: 'baixo' as NewsRisk, title: 'Fluxo estável nos perpétuos. Sem choque macro.' },
  { risk: 'medio' as NewsRisk, title: 'Volatilidade elevada após dado macro. Reduzir tamanho.' },
  { risk: 'alto' as NewsRisk, title: 'Evento de risco extremo. Bloquear novas entradas.' },
]

export function simulatedNews(symbol: HlSymbol, barTime: number): { risk: NewsRisk; title: string } {
  const rand = mulberry32(hash(`news:${symbol}:${Math.floor(barTime / 3600)}`))
  const roll = rand()
  if (roll > 0.93) return NEWS[2]!
  if (roll > 0.72) return NEWS[1]!
  return NEWS[0]!
}
