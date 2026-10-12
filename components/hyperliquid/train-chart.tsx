'use client'

import { useEffect, useRef } from 'react'
import { ema } from '@/lib/btc/indicators'
import type { HlBar } from '@/lib/hyperliquid/types'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'

type Props = {
  bars: HlBar[]
}

export function TrainChart({ bars }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const ema9Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ema21Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ema200Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const fittedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#07070b' },
        textColor: '#a1a1aa',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
    })
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    })
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
    const style = { lineWidth: 2 as const, priceLineVisible: false, lastValueVisible: false }
    chartRef.current = chart
    candleRef.current = candles
    volumeRef.current = volume
    ema9Ref.current = chart.addSeries(LineSeries, { ...style, color: '#34d399' })
    ema21Ref.current = chart.addSeries(LineSeries, { ...style, color: '#60a5fa' })
    ema200Ref.current = chart.addSeries(LineSeries, { ...style, color: '#facc15' })
    return () => {
      chart.remove()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!candleRef.current || bars.length < 2) return
    const closes = bars.map((b) => b.close)
    const toLine = (values: (number | null)[]) =>
      bars
        .map((b, i) => (values[i] == null ? null : { time: b.time as Time, value: values[i]! }))
        .filter((d): d is { time: Time; value: number } => d != null)
    candleRef.current.setData(
      bars.map((b) => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    )
    volumeRef.current?.setData(
      bars.map((b) => ({
        time: b.time as Time,
        value: b.volume,
        color: b.close >= b.open ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)',
      })),
    )
    ema9Ref.current?.setData(toLine(ema(closes, 9)))
    ema21Ref.current?.setData(toLine(ema(closes, 21)))
    ema200Ref.current?.setData(toLine(ema(closes, 200)))
    if (!fittedRef.current) {
      chartRef.current?.timeScale().fitContent()
      fittedRef.current = true
    }
  }, [bars])

  return <div ref={ref} className="h-full min-h-[280px] w-full" />
}
