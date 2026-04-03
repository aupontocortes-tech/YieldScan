'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
} from 'lightweight-charts'
import type { IChartApi, Time } from 'lightweight-charts'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import { BTC_CHART_THEME } from '@/lib/btc/chart-theme'
import { bollingerBands, macd, movingAverage, rsi, stochastic } from '@/lib/btc/indicators'
import type { OhlcvBar } from '@/lib/btc/types'

const { gold: GOLD } = BTC_CHART_THEME
const BG = '#050505'
const GRID = '#1c1917'
const TEXT = '#a1a1aa'

function baseLayout(width: number, height: number) {
  return {
    width,
    height,
    layout: {
      background: { type: ColorType.Solid, color: BG },
      textColor: TEXT,
      fontSize: 11,
    },
    grid: {
      vertLines: { color: GRID },
      horzLines: { color: GRID },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderColor: '#27272a' },
    timeScale: { borderColor: '#27272a', timeVisible: true, secondsVisible: false },
  } as const
}

function syncCharts(charts: IChartApi[]) {
  const syncing = { current: false }
  charts.forEach((c) => {
    c.timeScale().subscribeVisibleTimeRangeChange(() => {
      if (syncing.current) return
      const r = c.timeScale().getVisibleRange()
      if (!r) return
      syncing.current = true
      charts.forEach((o) => {
        if (o !== c) o.timeScale().setVisibleRange(r)
      })
      syncing.current = false
    })
  })
}

export function BtcChartsSuite({ bars }: { bars: OhlcvBar[] }) {
  const { mas, rsi: rsiCfg, macd: macdCfg, stoch: stochCfg, bollinger: bbCfg } = useBtcSettings()
  const wrapRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const rsiRef = useRef<HTMLDivElement>(null)
  const macdRef = useRef<HTMLDivElement>(null)
  const stochRef = useRef<HTMLDivElement>(null)

  const closes = useMemo(() => bars.map((b) => b.close), [bars])
  const highs = useMemo(() => bars.map((b) => b.high), [bars])
  const lows = useMemo(() => bars.map((b) => b.low), [bars])

  const rsiSeries = useMemo(() => rsi(closes, rsiCfg.period), [closes, rsiCfg.period])
  const bbSeries = useMemo(() => {
    if (!bbCfg.enabled || closes.length < bbCfg.period) return null
    return bollingerBands(closes, bbCfg.period, bbCfg.stdDev)
  }, [closes, bbCfg.enabled, bbCfg.period, bbCfg.stdDev])
  const macdOut = useMemo(
    () => macd(closes, macdCfg.fast, macdCfg.slow, macdCfg.signal),
    [closes, macdCfg.fast, macdCfg.slow, macdCfg.signal]
  )
  const stochOut = useMemo(
    () => stochastic(highs, lows, closes, stochCfg.kPeriod, stochCfg.dPeriod, stochCfg.smooth),
    [highs, lows, closes, stochCfg.kPeriod, stochCfg.dPeriod, stochCfg.smooth]
  )

  useEffect(() => {
    const wrap = wrapRef.current
    const elM = mainRef.current
    const elR = rsiRef.current
    const elMacd = macdRef.current
    const elS = stochRef.current
    if (!wrap || !elM || !elR || !elMacd || !elS || bars.length < 10) return

    const w = Math.max(wrap.clientWidth, 200)
    const charts: ReturnType<typeof createChart>[] = []

    const cMain = createChart(elM, {
      ...baseLayout(w, 380),
    })
    charts.push(cMain)

    const candle = cMain.addSeries(CandlestickSeries, {
      upColor: GOLD,
      downColor: BTC_CHART_THEME.candleDown,
      borderUpColor: GOLD,
      borderDownColor: BTC_CHART_THEME.candleDown,
      wickUpColor: GOLD,
      wickDownColor: BTC_CHART_THEME.candleDownWick,
    })
    candle.setData(
      bars.map((b) => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    )

    mas.forEach((ma) => {
      const vals = movingAverage(closes, ma.period, ma.type)
      const lineData = bars
        .map((b, i) => ({ time: b.time as Time, value: vals[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
      if (lineData.length === 0) return
      const s = cMain.addSeries(LineSeries, {
        color: ma.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      })
      s.setData(lineData)
    })

    if (bbSeries) {
      const lineOpts = { priceLineVisible: false, lastValueVisible: false }
      if (bbCfg.showUpper) {
        const u = cMain.addSeries(LineSeries, {
          color: BTC_CHART_THEME.bbUpper,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          ...lineOpts,
        })
        u.setData(
          bars
            .map((b, i) => ({ time: b.time as Time, value: bbSeries.upper[i] }))
            .filter((d): d is { time: Time; value: number } => d.value != null)
        )
      }
      if (bbCfg.showMiddle) {
        const mid = cMain.addSeries(LineSeries, {
          color: BTC_CHART_THEME.bbMiddle,
          lineWidth: 1,
          ...lineOpts,
        })
        mid.setData(
          bars
            .map((b, i) => ({ time: b.time as Time, value: bbSeries.middle[i] }))
            .filter((d): d is { time: Time; value: number } => d.value != null)
        )
      }
      if (bbCfg.showLower) {
        const lo = cMain.addSeries(LineSeries, {
          color: BTC_CHART_THEME.bbLower,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          ...lineOpts,
        })
        lo.setData(
          bars
            .map((b, i) => ({ time: b.time as Time, value: bbSeries.lower[i] }))
            .filter((d): d is { time: Time; value: number } => d.value != null)
        )
      }
    }

    const cRsi = createChart(elR, { ...baseLayout(w, 92) })
    charts.push(cRsi)
    const rsiLine = cRsi.addSeries(LineSeries, {
      color: GOLD,
      lineWidth: 2,
      priceLineVisible: false,
    })
    rsiLine.setData(
      bars
        .map((b, i) => ({ time: b.time as Time, value: rsiSeries[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
    )
    cRsi.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } })
    if (rsiCfg.showLevels) {
      rsiLine.createPriceLine({
        price: rsiCfg.oversold,
        color: BTC_CHART_THEME.rsiOversoldLine,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `${rsiCfg.oversold}`,
      })
      rsiLine.createPriceLine({
        price: rsiCfg.overbought,
        color: BTC_CHART_THEME.rsiOverboughtLine,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `${rsiCfg.overbought}`,
      })
    }

    const cMacd = createChart(elMacd, { ...baseLayout(w, 112) })
    charts.push(cMacd)
    const hist = cMacd.addSeries(HistogramSeries, {
      color: BTC_CHART_THEME.goldDim,
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    })
    hist.setData(
      bars.map((b, i) => {
        const v = macdOut.hist[i]
        return {
          time: b.time as Time,
          value: v ?? 0,
          color: (v ?? 0) >= 0 ? BTC_CHART_THEME.macdHistogramPos : BTC_CHART_THEME.macdHistogramNeg,
        }
      })
    )
    const macdL = cMacd.addSeries(LineSeries, {
      color: GOLD,
      lineWidth: 2,
      priceLineVisible: false,
    })
    macdL.setData(
      bars
        .map((b, i) => ({ time: b.time as Time, value: macdOut.line[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
    )
    const sigL = cMacd.addSeries(LineSeries, {
      color: BTC_CHART_THEME.macdSignal,
      lineWidth: 1,
      priceLineVisible: false,
    })
    sigL.setData(
      bars
        .map((b, i) => ({ time: b.time as Time, value: macdOut.signal[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
    )

    const cStoch = createChart(elS, { ...baseLayout(w, 92) })
    charts.push(cStoch)
    const kL = cStoch.addSeries(LineSeries, {
      color: GOLD,
      lineWidth: 2,
      priceLineVisible: false,
    })
    kL.setData(
      bars
        .map((b, i) => ({ time: b.time as Time, value: stochOut.k[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
    )
    const dL = cStoch.addSeries(LineSeries, {
      color: BTC_CHART_THEME.stochD,
      lineWidth: 1,
      priceLineVisible: false,
    })
    dL.setData(
      bars
        .map((b, i) => ({ time: b.time as Time, value: stochOut.d[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
    )

    syncCharts(charts)
    charts.forEach((c) => c.timeScale().fitContent())

    const ro = new ResizeObserver(() => {
      const nw = Math.max(wrap.clientWidth, 200)
      const hMain = 380
      const hRsi = 92
      const hMacd = 112
      const hSt = 92
      cMain.applyOptions({ width: nw, height: hMain })
      cRsi.applyOptions({ width: nw, height: hRsi })
      cMacd.applyOptions({ width: nw, height: hMacd })
      cStoch.applyOptions({ width: nw, height: hSt })
    })
    ro.observe(wrap)

    return () => {
      ro.disconnect()
      charts.forEach((c) => c.remove())
    }
  }, [bars, closes, mas, rsiCfg, macdCfg, stochCfg, rsiSeries, macdOut, stochOut, bbSeries, bbCfg])

  if (bars.length < 10) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-[#d4af37]/20 bg-black/60 text-sm text-zinc-500">
        A carregar velas…
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      data-no-swipe-nav
      className="flex w-full flex-col gap-0.5 overflow-hidden rounded-xl border border-[#d4af37]/30 bg-[#050505] shadow-[0_0_40px_rgba(212,175,55,0.06)]"
    >
      <div className="border-b border-[#d4af37]/15 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-[#d4af37]/80">
        BTC / USDT · Candlestick · MAs · Bollinger
      </div>
      <div ref={mainRef} className="w-full" />
      <div className="border-t border-[#d4af37]/10 px-2 py-0.5 text-[10px] text-zinc-500">RSI</div>
      <div ref={rsiRef} className="w-full" />
      <div className="border-t border-[#d4af37]/10 px-2 py-0.5 text-[10px] text-zinc-500">MACD</div>
      <div ref={macdRef} className="w-full" />
      <div className="border-t border-[#d4af37]/10 px-2 py-0.5 text-[10px] text-zinc-500">Stochastic</div>
      <div ref={stochRef} className="w-full" />
    </div>
  )
}
