import type { Time } from 'lightweight-charts'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import type { OhlcvBar } from '@/lib/btc/types'

export type ChartIndicatorHitTarget = {
  id: string
  label: string
  colors: string[]
  values: (number | null)[]
}

const HIT_PX = 14

function timeAtX(chart: IChartApi, x: number, bars: OhlcvBar[]): number | null {
  const ts = chart.timeScale()
  const direct = ts.coordinateToTime(x)
  if (direct != null) return direct as number
  if (bars.length < 2) return null
  const logical = ts.coordinateToLogical(x)
  if (logical == null) return null
  const x0 = ts.timeToCoordinate(bars[0].time as Time)
  const x1 = ts.timeToCoordinate(bars[bars.length - 1].time as Time)
  if (x0 == null || x1 == null) return null
  const l0 = ts.coordinateToLogical(x0)
  const l1 = ts.coordinateToLogical(x1)
  if (l0 == null || l1 == null || l1 === l0) return null
  const t0 = bars[0].time
  const t1 = bars[bars.length - 1].time
  return t0 + ((logical - l0) / (l1 - l0)) * (t1 - t0)
}

function barIndexForTime(bars: OhlcvBar[], time: number): number {
  let lo = 0
  let hi = bars.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (bars[mid].time <= time) lo = mid
    else hi = mid - 1
  }
  return lo
}

function valueAtIndex(values: (number | null)[], index: number): number | null {
  if (index < 0 || index >= values.length) return null
  const v = values[index]
  if (v != null) return v
  for (let i = index; i >= 0; i--) {
    if (values[i] != null) return values[i]
  }
  for (let i = index + 1; i < values.length; i++) {
    if (values[i] != null) return values[i]
  }
  return null
}

export function hitChartIndicatorAt(
  clientX: number,
  clientY: number,
  container: HTMLElement,
  chart: IChartApi,
  priceSeries: ISeriesApi<'Candlestick'>,
  bars: OhlcvBar[],
  targets: ChartIndicatorHitTarget[],
): ChartIndicatorHitTarget | null {
  if (!targets.length || !bars.length) return null
  const rect = container.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  const time = timeAtX(chart, x, bars)
  if (time == null) return null
  const idx = barIndexForTime(bars, time)

  let best: { target: ChartIndicatorHitTarget; dist: number } | null = null
  for (const target of targets) {
    const price = valueAtIndex(target.values, idx)
    if (price == null) continue
    const lineY = priceSeries.priceToCoordinate(price)
    if (lineY == null) continue
    const dist = Math.abs(y - lineY)
    if (dist <= HIT_PX && (!best || dist < best.dist)) {
      best = { target, dist }
    }
  }
  return best?.target ?? null
}
