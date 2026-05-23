import type { Time } from 'lightweight-charts'
import type { ChartApiRef, ChartPoint } from '@/lib/drawing-system/types'
import { snapPoint } from '@/lib/drawing-system/utils/snap'
import type { OhlcvBar } from '@/lib/btc/types'

export type XY = { x: number; y: number }

export class CoordinateMapper {
  constructor(
    private api: ChartApiRef,
    private bars: OhlcvBar[],
    private magnet: boolean,
  ) {}

  setApi(api: ChartApiRef) {
    this.api = api
  }

  setBars(bars: OhlcvBar[]) {
    this.bars = bars
  }

  setMagnet(magnet: boolean) {
    this.magnet = magnet
  }

  toXY(pt: ChartPoint): XY | null {
    if (!this.api) return null
    const x = this.api.chart.timeScale().timeToCoordinate(pt.time as Time)
    const y = this.api.series.priceToCoordinate(pt.price)
    if (x == null || y == null) return null
    return { x, y }
  }

  fromXY(x: number, y: number): ChartPoint | null {
    if (!this.api) return null
    const time = this.api.chart.timeScale().coordinateToTime(x)
    const price = this.api.series.coordinateToPrice(y)
    if (time == null || price == null) return null
    return snapPoint({ time: time as number, price }, this.bars, this.magnet)
  }

  pointsToXY(points: ChartPoint[]): XY[] {
    return points.map((p) => this.toXY(p)).filter((p): p is XY => p != null)
  }
}
