import type { OhlcvBar } from '@/lib/btc/types'

export type HeikinAshiBar = OhlcvBar & {
  haOpen: number
  haHigh: number
  haLow: number
  haClose: number
}

/** Converte velas OHLC em Heikin Ashi (sequência temporal). */
export function toHeikinAshi(bars: OhlcvBar[]): HeikinAshiBar[] {
  const out: HeikinAshiBar[] = []
  let prevHaOpen = bars[0]?.open ?? 0
  let prevHaClose = bars[0]?.close ?? 0

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]
    const haClose = (b.open + b.high + b.low + b.close) / 4
    const haOpen = i === 0 ? (b.open + b.close) / 2 : (prevHaOpen + prevHaClose) / 2
    const haHigh = Math.max(b.high, haOpen, haClose)
    const haLow = Math.min(b.low, haOpen, haClose)
    out.push({
      ...b,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      haOpen,
      haHigh,
      haLow,
      haClose,
    })
    prevHaOpen = haOpen
    prevHaClose = haClose
  }
  return out
}
