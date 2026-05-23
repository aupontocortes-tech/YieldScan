import type { ChartPoint } from '@/lib/drawing-system/types'
import type { OhlcvBar } from '@/lib/btc/types'

function nearestBar(bars: OhlcvBar[], time: number): OhlcvBar | null {
  if (!bars.length) return null
  let best = bars[0]
  let bestD = Math.abs(best.time - time)
  for (const b of bars) {
    const d = Math.abs(b.time - time)
    if (d < bestD) {
      best = b
      bestD = d
    }
  }
  return best
}

export function snapPoint(pt: ChartPoint, bars: OhlcvBar[], enabled: boolean): ChartPoint {
  if (!enabled || !bars.length) return pt
  const bar = nearestBar(bars, pt.time)
  if (!bar) return pt
  const candidates = [bar.open, bar.high, bar.low, bar.close]
  let price = pt.price
  let min = Infinity
  for (const c of candidates) {
    const d = Math.abs(c - pt.price)
    if (d < min) {
      min = d
      price = c
    }
  }
  /** Mantém o tempo do cursor; só ajusta o preço ao OHLC (como TradingView). */
  return { time: pt.time, price }
}
