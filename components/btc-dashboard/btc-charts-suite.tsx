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
import { bollingerBands, macd, movingAverage, rsi, sma, stochastic } from '@/lib/btc/indicators'
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
    grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
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
      charts.forEach((o) => { if (o !== c) o.timeScale().setVisibleRange(r) })
      syncing.current = false
    })
  })
}

export function BtcChartsSuite({ bars }: { bars: OhlcvBar[] }) {
  const { mas, rsi: rsiCfg, macd: macdCfg, stoch: stochCfg, bollinger: bbCfg, zones: zonesCfg } = useBtcSettings()
  const wrapRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const rsiRef = useRef<HTMLDivElement>(null)
  const macdRef = useRef<HTMLDivElement>(null)
  const stochRef = useRef<HTMLDivElement>(null)

  const closes = useMemo(() => bars.map((b) => b.close), [bars])
  const highs = useMemo(() => bars.map((b) => b.high), [bars])
  const lows = useMemo(() => bars.map((b) => b.low), [bars])

  const rsiSeries = useMemo(
    () => (rsiCfg.enabled ? rsi(closes, rsiCfg.period) : null),
    [closes, rsiCfg.enabled, rsiCfg.period]
  )
  const macdOut = useMemo(
    () => (macdCfg.enabled ? macd(closes, macdCfg.fast, macdCfg.slow, macdCfg.signal) : null),
    [closes, macdCfg.enabled, macdCfg.fast, macdCfg.slow, macdCfg.signal]
  )
  const stochOut = useMemo(
    () => (stochCfg.enabled ? stochastic(highs, lows, closes, stochCfg.kPeriod, stochCfg.dPeriod, stochCfg.smooth) : null),
    [highs, lows, closes, stochCfg.enabled, stochCfg.kPeriod, stochCfg.dPeriod, stochCfg.smooth]
  )
  const bbSeries = useMemo(() => {
    if (!bbCfg.enabled || closes.length < bbCfg.period) return null
    return bollingerBands(closes, bbCfg.period, bbCfg.stdDev)
  }, [closes, bbCfg.enabled, bbCfg.period, bbCfg.stdDev])

  // Zones computed values
  const zoneValues = useMemo(() => {
    if (!zonesCfg.enabled || closes.length < 10) return null
    const n = closes.length
    const i = n - 1
    const ma50v = sma(closes, 50)[i]
    const ma100v = sma(closes, 100)[i]
    const ma200v = sma(closes, 200)[i]
    const recentHigh = Math.max(...highs.slice(-50))
    const recentLow = Math.min(...lows.slice(-50))
    return { ma50v, ma100v, ma200v, recentHigh, recentLow }
  }, [closes, highs, lows, zonesCfg.enabled])

  useEffect(() => {
    const wrap = wrapRef.current
    const elM = mainRef.current
    const elR = rsiRef.current
    const elMacd = macdRef.current
    const elS = stochRef.current
    if (!wrap || !elM || !elR || !elMacd || !elS || bars.length < 10) return

    const w = Math.max(wrap.clientWidth, 200)
    const charts: ReturnType<typeof createChart>[] = []

    // ── Main chart ───────────────────────────────────────
    const cMain = createChart(elM, { ...baseLayout(w, 400) })
    charts.push(cMain)

    cMain.addSeries(CandlestickSeries, {
      upColor: GOLD,
      downColor: BTC_CHART_THEME.candleDown,
      borderUpColor: GOLD,
      borderDownColor: BTC_CHART_THEME.candleDown,
      wickUpColor: GOLD,
      wickDownColor: BTC_CHART_THEME.candleDownWick,
    }).setData(bars.map((b) => ({ time: b.time as Time, open: b.open, high: b.high, low: b.low, close: b.close })))

    // Moving averages
    mas.forEach((ma) => {
      const vals = movingAverage(closes, ma.period, ma.type)
      const lineData = bars
        .map((b, i) => ({ time: b.time as Time, value: vals[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
      if (!lineData.length) return
      cMain.addSeries(LineSeries, { color: ma.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true }).setData(lineData)
    })

    // Bollinger Bands
    if (bbSeries) {
      const bOpts = { priceLineVisible: false, lastValueVisible: false }
      if (bbCfg.showUpper)
        cMain.addSeries(LineSeries, { color: BTC_CHART_THEME.bbUpper, lineWidth: 1, lineStyle: LineStyle.Dotted, ...bOpts })
          .setData(bars.map((b, i) => ({ time: b.time as Time, value: bbSeries.upper[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
      if (bbCfg.showMiddle)
        cMain.addSeries(LineSeries, { color: BTC_CHART_THEME.bbMiddle, lineWidth: 1, ...bOpts })
          .setData(bars.map((b, i) => ({ time: b.time as Time, value: bbSeries.middle[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
      if (bbCfg.showLower)
        cMain.addSeries(LineSeries, { color: BTC_CHART_THEME.bbLower, lineWidth: 1, lineStyle: LineStyle.Dotted, ...bOpts })
          .setData(bars.map((b, i) => ({ time: b.time as Time, value: bbSeries.lower[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
    }

    // ── Zones (price lines) ─────────────────────────────
    if (zonesCfg.enabled && zoneValues) {
      const { ma50v, ma100v, ma200v, recentHigh, recentLow } = zoneValues
      const addLine = (series: ReturnType<typeof cMain.addSeries>, price: number, color: string, title: string, dashed = false) => {
        series.createPriceLine({ price, color, lineWidth: 1, lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid, axisLabelVisible: true, title })
      }
      // Use candle series as anchor for price lines
      const dummy = cMain.addSeries(LineSeries, { visible: false, priceLineVisible: false, lastValueVisible: false })

      if (zonesCfg.showMaZones) {
        if (ma50v != null) dummy.createPriceLine({ price: ma50v, color: BTC_CHART_THEME.zoneMa50, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'MA50' })
        if (ma100v != null) dummy.createPriceLine({ price: ma100v, color: BTC_CHART_THEME.zoneMa100, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'MA100' })
        if (ma200v != null) dummy.createPriceLine({ price: ma200v, color: BTC_CHART_THEME.zoneMa200, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'MA200' })
      }

      if (zonesCfg.showSupportResistance) {
        dummy.createPriceLine({ price: recentHigh, color: BTC_CHART_THEME.zoneExtremeTop, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: 'Máximo Recente' })
        dummy.createPriceLine({ price: recentLow, color: BTC_CHART_THEME.zoneDiscount, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: 'Mínimo Recente' })
      }

      if (zonesCfg.showSmartMultipliers && ma200v != null) {
        const zones = [
          { mult: 1.8, color: BTC_CHART_THEME.zoneExtremeTop, label: 'Topo Extremo (×1.8)' },
          { mult: 1.4, color: BTC_CHART_THEME.zoneWarning, label: 'Zona Aviso (×1.4)' },
          { mult: 1.0, color: BTC_CHART_THEME.zoneFairValue, label: 'Valor Justo (×1.0)' },
          { mult: 0.8, color: BTC_CHART_THEME.zoneDiscount, label: 'Desconto (×0.8)' },
          { mult: 0.6, color: BTC_CHART_THEME.zoneExtremeBottom, label: 'Fundo Extremo (×0.6)' },
        ]
        zones.forEach(({ mult, color, label }) => {
          const price = ma200v * mult
          if (price > 0) addLine(dummy, price, color, label, true)
        })
      }
    }

    // ── RSI chart ────────────────────────────────────────
    if (rsiCfg.enabled && rsiSeries) {
      const cRsi = createChart(elR, { ...baseLayout(w, 96) })
      charts.push(cRsi)
      const rsiLine = cRsi.addSeries(LineSeries, { color: GOLD, lineWidth: 2, priceLineVisible: false })
      rsiLine.setData(bars.map((b, i) => ({ time: b.time as Time, value: rsiSeries[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
      cRsi.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } })
      if (rsiCfg.showLevels) {
        rsiLine.createPriceLine({ price: rsiCfg.oversold, color: BTC_CHART_THEME.rsiOversoldLine, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: String(rsiCfg.oversold) })
        rsiLine.createPriceLine({ price: rsiCfg.overbought, color: BTC_CHART_THEME.rsiOverboughtLine, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: String(rsiCfg.overbought) })
      }
    }

    // ── MACD chart ───────────────────────────────────────
    if (macdCfg.enabled && macdOut) {
      const cMacd = createChart(elMacd, { ...baseLayout(w, 112) })
      charts.push(cMacd)
      cMacd.addSeries(HistogramSeries, { color: BTC_CHART_THEME.goldDim, priceFormat: { type: 'price', precision: 4, minMove: 0.0001 } })
        .setData(bars.map((b, i) => ({ time: b.time as Time, value: macdOut.hist[i] ?? 0, color: (macdOut.hist[i] ?? 0) >= 0 ? BTC_CHART_THEME.macdHistogramPos : BTC_CHART_THEME.macdHistogramNeg })))
      cMacd.addSeries(LineSeries, { color: GOLD, lineWidth: 2, priceLineVisible: false })
        .setData(bars.map((b, i) => ({ time: b.time as Time, value: macdOut.line[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
      cMacd.addSeries(LineSeries, { color: BTC_CHART_THEME.macdSignal, lineWidth: 1, priceLineVisible: false })
        .setData(bars.map((b, i) => ({ time: b.time as Time, value: macdOut.signal[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
    }

    // ── Stochastic chart ─────────────────────────────────
    if (stochCfg.enabled && stochOut) {
      const cStoch = createChart(elS, { ...baseLayout(w, 96) })
      charts.push(cStoch)
      cStoch.addSeries(LineSeries, { color: GOLD, lineWidth: 2, priceLineVisible: false })
        .setData(bars.map((b, i) => ({ time: b.time as Time, value: stochOut.k[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
      cStoch.addSeries(LineSeries, { color: BTC_CHART_THEME.stochD, lineWidth: 1, priceLineVisible: false })
        .setData(bars.map((b, i) => ({ time: b.time as Time, value: stochOut.d[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
    }

    syncCharts(charts)
    charts.forEach((c) => c.timeScale().fitContent())

    const ro = new ResizeObserver(() => {
      const nw = Math.max(wrap.clientWidth, 200)
      cMain.applyOptions({ width: nw })
      charts.slice(1).forEach((c) => c.applyOptions({ width: nw }))
    })
    ro.observe(wrap)

    return () => { ro.disconnect(); charts.forEach((c) => c.remove()) }
  }, [bars, closes, mas, rsiCfg, macdCfg, stochCfg, rsiSeries, macdOut, stochOut, bbSeries, bbCfg, zonesCfg, zoneValues, highs, lows])

  if (bars.length < 10) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-[#d4af37]/20 bg-black/60 text-sm text-zinc-500">
        A carregar velas…
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      data-no-swipe-nav
      className="flex w-full flex-col gap-0 overflow-hidden rounded-xl border border-[#d4af37]/25 bg-[#050505] shadow-[0_0_40px_rgba(212,175,55,0.05)]"
    >
      <div className="flex items-center justify-between border-b border-[#d4af37]/15 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#d4af37]/80">
          BTC / USDT
        </span>
        <div className="flex gap-3 text-[9px] text-zinc-600 uppercase tracking-wider">
          {mas.length > 0 && <span>MAs</span>}
          {bbCfg.enabled && <span>Bollinger</span>}
          {zonesCfg.enabled && <span>Zonas</span>}
        </div>
      </div>
      <div ref={mainRef} className="w-full" />
      {rsiCfg.enabled && (
        <>
          <div className="border-t border-[#d4af37]/10 px-3 py-1 text-[9px] font-medium uppercase tracking-widest text-zinc-500">RSI ({rsiCfg.period})</div>
          <div ref={rsiRef} className="w-full" />
        </>
      )}
      {macdCfg.enabled && (
        <>
          <div className="border-t border-[#d4af37]/10 px-3 py-1 text-[9px] font-medium uppercase tracking-widest text-zinc-500">MACD</div>
          <div ref={macdRef} className="w-full" />
        </>
      )}
      {stochCfg.enabled && (
        <>
          <div className="border-t border-[#d4af37]/10 px-3 py-1 text-[9px] font-medium uppercase tracking-widest text-zinc-500">Stochastic</div>
          <div ref={stochRef} className="w-full" />
        </>
      )}
    </div>
  )
}
