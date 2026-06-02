import type { ChartApiRef, ChartPoint } from '@/lib/drawing-system/types'
import {
  buildLogicalTimeMap,
  timeToX,
  xToTime,
  type LogicalTimeMap,
} from '@/lib/drawing-system/core/time-scale-extrapolation'
import { snapPoint } from '@/lib/drawing-system/utils/snap'
import type { OhlcvBar } from '@/lib/btc/types'

export type XY = { x: number; y: number }

export class CoordinateMapper {
  private logicalMap: LogicalTimeMap | null = null

  constructor(
    private api: ChartApiRef,
    private bars: OhlcvBar[],
    private magnet: boolean,
  ) {
    this.logicalMap = buildLogicalTimeMap(api, bars)
  }

  setApi(api: ChartApiRef) {
    this.api = api
    this.logicalMap = buildLogicalTimeMap(api, this.bars)
  }

  setBars(bars: OhlcvBar[]) {
    this.bars = bars
    if (this.api) this.logicalMap = buildLogicalTimeMap(this.api, bars)
  }

  setMagnet(magnet: boolean) {
    this.magnet = magnet
  }

  /** Recalibrar após zoom/scroll — o mapeamento lógico↔tempo depende da escala visível. */
  refreshLogicalMap() {
    if (this.api) this.logicalMap = buildLogicalTimeMap(this.api, this.bars)
  }

  toXY(pt: ChartPoint): XY | null {
    if (!this.api) return null
    const x = timeToX(this.api, pt.time, this.logicalMap)
    const y = this.api.series.priceToCoordinate(pt.price)
    if (x == null || y == null) return null
    return { x, y }
  }

  fromXY(x: number, y: number, options?: { snap?: boolean }): ChartPoint | null {
    if (!this.api) return null
    const time = xToTime(this.api, x, this.logicalMap)
    const price = this.api.series.coordinateToPrice(y)
    if (time == null || price == null) return null
    const raw = { time, price }
    if (options?.snap === false) return raw
    return snapPoint(raw, this.bars, this.magnet)
  }

  pointsToXY(points: ChartPoint[]): XY[] {
    return points.map((p) => this.toXY(p)).filter((p): p is XY => p != null)
  }
}
