import type { ChartPoint, FibLevelConfig, FibRetracementData } from '@/lib/drawing-system/types'
import { formatMeasurePrice } from '@/lib/drawing-system/utils/measure'

/** Níveis padrão TradingView. */
export const DEFAULT_FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const

export function createDefaultFibLevels(): FibLevelConfig[] {
  return DEFAULT_FIB_RATIOS.map((ratio) => ({
    ratio,
    visible: true,
  }))
}

export function createDefaultFibData(): FibRetracementData {
  return {
    levels: createDefaultFibLevels(),
    showTrendLine: true,
    showBackground: true,
    extendRight: true,
  }
}

export function resolveFibData(fib?: FibRetracementData): FibRetracementData {
  if (!fib?.levels?.length) return createDefaultFibData()
  return {
    ...createDefaultFibData(),
    ...fib,
    levels: fib.levels.length ? fib.levels : createDefaultFibLevels(),
  }
}

/** Preço no nível — interpolação linear entre os dois pontos âncora (0 = p0, 1 = p1). */
export function fibLevelPrice(p0: ChartPoint, p1: ChartPoint, ratio: number): number {
  return p0.price + (p1.price - p0.price) * ratio
}

export function fibTimeBounds(p0: ChartPoint, p1: ChartPoint) {
  return {
    timeMin: Math.min(p0.time, p1.time),
    timeMax: Math.max(p0.time, p1.time),
  }
}

export function formatFibRatio(ratio: number): string {
  if (ratio === 0) return '0'
  if (ratio === 1) return '1'
  const s = ratio.toFixed(3)
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

export function formatFibLabel(ratio: number, price: number): string {
  return `${formatFibRatio(ratio)} (${formatMeasurePrice(price)})`
}

export type FibLevelComputed = {
  ratio: number
  price: number
  visible: boolean
  color?: string
  lineWidth?: number
  index: number
}

export function computeFibLevels(
  p0: ChartPoint,
  p1: ChartPoint,
  fib: FibRetracementData | undefined,
): FibLevelComputed[] {
  const data = resolveFibData(fib)
  return data.levels
    .map((lvl, index) => ({
      ratio: lvl.ratio,
      price: fibLevelPrice(p0, p1, lvl.ratio),
      visible: lvl.visible,
      color: lvl.color,
      lineWidth: lvl.lineWidth,
      index,
    }))
    .filter((l) => l.visible)
    .sort((a, b) => a.price - b.price)
}

/** Cores de preenchimento entre níveis (estilo TV). */
export function fibBandFill(index: number, selected: boolean): string {
  if (selected) {
    return index % 2 === 0 ? 'rgba(240, 185, 11, 0.06)' : 'rgba(240, 185, 11, 0.03)'
  }
  return index % 2 === 0 ? 'rgba(41, 98, 255, 0.05)' : 'rgba(41, 98, 255, 0.025)'
}
