import type { ChartPoint } from '@/lib/drawing-system/types'
import type { OhlcvBar } from '@/lib/btc/types'

export type MeasureStats = {
  priceFrom: number
  priceTo: number
  priceDelta: number
  percent: number
  bars: number
  seconds: number
  angleDeg: number
}

export function nearestBarIndex(bars: OhlcvBar[], time: number): number {
  if (!bars.length) return 0
  let best = 0
  let bestD = Math.abs(bars[0].time - time)
  for (let i = 1; i < bars.length; i++) {
    const d = Math.abs(bars[i].time - time)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

export function computeMeasure(
  p0: ChartPoint,
  p1: ChartPoint,
  bars: OhlcvBar[],
  pixelDx = 0,
  pixelDy = 0,
): MeasureStats {
  const priceFrom = p0.price
  const priceTo = p1.price
  const priceDelta = priceTo - priceFrom
  const percent = priceFrom !== 0 ? (priceDelta / priceFrom) * 100 : 0
  const i0 = nearestBarIndex(bars, p0.time)
  const i1 = nearestBarIndex(bars, p1.time)
  const angleDeg =
    pixelDx !== 0 || pixelDy !== 0 ? (Math.atan2(-pixelDy, pixelDx) * 180) / Math.PI : 0
  return {
    priceFrom,
    priceTo,
    priceDelta,
    percent,
    bars: Math.abs(i1 - i0),
    seconds: Math.abs(p1.time - p0.time),
    angleDeg,
  }
}

export function formatMeasurePrice(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 10_000) return n.toLocaleString('pt-PT', { maximumFractionDigits: 0 })
  if (abs >= 1) return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n.toLocaleString('pt-PT', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

export function formatMeasureDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`
  const days = seconds / 86400
  if (days < 60) return `${days.toFixed(1)}d`
  return `${(days / 30).toFixed(1)}M`
}

export function measureLabelLines(stats: MeasureStats): string[] {
  const sign = stats.priceDelta >= 0 ? '+' : ''
  const pctSign = stats.percent >= 0 ? '+' : ''
  return [
    `${sign}${formatMeasurePrice(stats.priceDelta)} (${pctSign}${stats.percent.toFixed(2)}%)`,
    `${stats.bars} ${stats.bars === 1 ? 'barra' : 'barras'}`,
    formatMeasureDuration(stats.seconds),
    `${stats.angleDeg.toFixed(1)}°`,
  ]
}
