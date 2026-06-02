import type { Logical, Time } from 'lightweight-charts'
import type { ChartApiRef } from '@/lib/drawing-system/types'
import type { OhlcvBar } from '@/lib/btc/types'

export type LogicalTimeMap = {
  toTime: (logical: number) => number
  toLogical: (time: number) => number
}

/** Passo temporal médio entre velas (para extrapolar além dos dados). */
export function inferBarTimeStep(bars: OhlcvBar[]): number {
  if (bars.length < 2) return 86_400
  const n = Math.min(8, bars.length - 1)
  let sum = 0
  for (let i = bars.length - n; i < bars.length; i++) {
    sum += bars[i].time - bars[i - 1].time
  }
  return sum / n
}

/**
 * Mapeia índice lógico ↔ tempo usando dois pontos calibrados no gráfico.
 * Permite desenhar na faixa vazia à direita (right offset) e além da última vela.
 */
export function buildLogicalTimeMap(api: ChartApiRef, bars: OhlcvBar[]): LogicalTimeMap | null {
  if (bars.length < 2) return null
  const ts = api.chart.timeScale()
  const t0 = bars[0].time
  const t1 = bars[bars.length - 1].time
  const x0 = ts.timeToCoordinate(t0 as Time)
  const x1 = ts.timeToCoordinate(t1 as Time)
  if (x0 == null || x1 == null) return null
  const l0 = ts.coordinateToLogical(x0)
  const l1 = ts.coordinateToLogical(x1)
  if (l0 == null || l1 == null || l1 === l0) return null
  const slope = (t1 - t0) / (l1 - l0)
  return {
    toTime: (logical) => t0 + (logical - l0) * slope,
    toLogical: (time) => l0 + (time - t0) / slope,
  }
}

export function logicalToX(
  api: ChartApiRef,
  logical: number,
  map: LogicalTimeMap | null,
): number | null {
  const ts = api.chart.timeScale()
  const x = ts.logicalToCoordinate(logical as Logical)
  if (x != null) return x
  if (!map) return null
  const range = ts.getVisibleLogicalRange()
  if (!range || range.to === range.from) return null
  const xFrom = ts.logicalToCoordinate(range.from)
  const xTo = ts.logicalToCoordinate(range.to)
  if (xFrom == null || xTo == null) return null
  const ratio = (logical - range.from) / (range.to - range.from)
  return xFrom + ratio * (xTo - xFrom)
}

export function xToTime(
  api: ChartApiRef,
  x: number,
  map: LogicalTimeMap | null,
): number | null {
  const ts = api.chart.timeScale()
  const time = ts.coordinateToTime(x)
  if (time != null) return time as number
  const logical = ts.coordinateToLogical(x)
  if (logical == null || !map) return null
  return map.toTime(logical)
}

export function timeToX(
  api: ChartApiRef,
  time: number,
  map: LogicalTimeMap | null,
): number | null {
  const ts = api.chart.timeScale()
  const x = ts.timeToCoordinate(time as Time)
  if (x != null) return x
  if (!map) return null
  const logical = map.toLogical(time)
  return logicalToX(api, logical, map)
}
