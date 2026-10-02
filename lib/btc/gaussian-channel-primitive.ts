import type { IChartApi, ISeriesApi, ISeriesPrimitive, SeriesAttachedParameter, Time } from 'lightweight-charts'
import { GAUSSIAN_COLOR_DOWN, GAUSSIAN_COLOR_UP, type GaussianChannelSeries } from '@/lib/btc/gaussian-channel'
import type { OhlcvBar } from '@/lib/btc/types'

type Point = { x: number; up: number; lo: number; rising: boolean }

type BitmapScope = {
  context: CanvasRenderingContext2D
  horizontalPixelRatio: number
  verticalPixelRatio: number
}

type DrawTarget = {
  useBitmapCoordinateSpace: (fn: (scope: BitmapScope) => void) => void
}

/**
 * Faixa do GC [DW] desenhada por baixo das velas: verde na subida, vermelha na descida.
 */
export function createGaussianChannelPrimitive(
  bars: OhlcvBar[],
  channel: GaussianChannelSeries,
): ISeriesPrimitive<Time> {
  let chart: IChartApi | null = null
  let series: ISeriesApi<'Candlestick'> | null = null
  let points: Point[] = []

  const view = {
    zOrder: () => 'bottom' as const,
    renderer: () => ({
      draw(target: DrawTarget) {
        if (!points.length) return
        target.useBitmapCoordinateSpace((scope) => {
          const ctx = scope.context
          const hr = scope.horizontalPixelRatio
          const vr = scope.verticalPixelRatio
          let start = 0
          for (let i = 1; i <= points.length; i++) {
            const split = i === points.length || points[i]!.rising !== points[start]!.rising
            if (!split) continue
            const run = points.slice(start, i)
            const color = points[start]!.rising ? GAUSSIAN_COLOR_UP : GAUSSIAN_COLOR_DOWN
            ctx.beginPath()
            ctx.moveTo(run[0]!.x * hr, run[0]!.up * vr)
            for (let k = 1; k < run.length; k++) ctx.lineTo(run[k]!.x * hr, run[k]!.up * vr)
            for (let k = run.length - 1; k >= 0; k--) ctx.lineTo(run[k]!.x * hr, run[k]!.lo * vr)
            ctx.closePath()
            ctx.fillStyle = hexAlpha(color, 0.55)
            ctx.fill()
            ctx.beginPath()
            ctx.moveTo(run[0]!.x * hr, run[0]!.up * vr)
            for (let k = 1; k < run.length; k++) ctx.lineTo(run[k]!.x * hr, run[k]!.up * vr)
            ctx.moveTo(run[0]!.x * hr, run[0]!.lo * vr)
            for (let k = 1; k < run.length; k++) ctx.lineTo(run[k]!.x * hr, run[k]!.lo * vr)
            ctx.strokeStyle = color
            ctx.lineWidth = 1.6 * hr
            ctx.stroke()
            start = i
          }
        })
      },
    }),
  }

  const paneViews = [view]

  const rebuild = () => {
    points = []
    if (!chart || !series) return
    for (let i = 0; i < bars.length; i++) {
      const hi = channel.upper[i]
      const lo = channel.lower[i]
      if (hi == null || lo == null) continue
      const x = chart.timeScale().timeToCoordinate(bars[i]!.time as Time)
      const yHi = series.priceToCoordinate(hi)
      const yLo = series.priceToCoordinate(lo)
      if (x == null || yHi == null || yLo == null) continue
      points.push({ x, up: yHi, lo: yLo, rising: channel.rising[i] ?? true })
    }
  }

  return {
    attached(param: SeriesAttachedParameter<Time>) {
      chart = param.chart
      series = param.series as ISeriesApi<'Candlestick'>
    },
    detached() {
      chart = null
      series = null
      points = []
    },
    updateAllViews: rebuild,
    paneViews: () => paneViews,
    autoscaleInfo() {
      let min = Infinity
      let max = -Infinity
      for (let i = 0; i < bars.length; i++) {
        const hi = channel.upper[i]
        const lo = channel.lower[i]
        if (hi == null || lo == null) continue
        if (lo < min) min = lo
        if (hi > max) max = hi
      }
      if (!Number.isFinite(min) || !Number.isFinite(max)) return null
      return { priceRange: { minValue: min, maxValue: max } }
    },
  }
}

function hexAlpha(hex: string, alpha: number): string {
  const n = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
  return `${hex}${n.toString(16).padStart(2, '0')}`
}
