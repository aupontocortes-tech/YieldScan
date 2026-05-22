'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  AreaSeries,
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
import {
  bollingerBands,
  ema,
  macd,
  movingAverage,
  rsi,
  sma,
  stochastic,
} from '@/lib/btc/indicators'
import {
  syntheticMvrv,
  syntheticMvrvZScore,
  syntheticNupl,
  syntheticSopr,
} from '@/lib/btc/on-chain-synthetic'
import {
  computeBullMarketBandOnChart,
  computeSma200OnDailyAligned,
  computeSma50OnWeeklyAligned,
} from '@/lib/btc/cycle-bottom'
import { toHeikinAshi } from '@/lib/btc/heikin-ashi'
import {
  BULL_MARKET_BAND_EMA_WEEKS,
  BULL_MARKET_BAND_SMA_WEEKS,
  type OhlcvBar,
} from '@/lib/btc/types'

const BG = '#050505'
const GRID = '#1a1a1a'
const TEXT = '#d4d4d8'

/** Espaço extra (px) entre o último ponto e a régua de preços — evita que o rótulo tape a ponta da linha. */
const TIME_SCALE_RIGHT_GAP_PX = 14

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
    timeScale: {
      borderColor: '#27272a',
      timeVisible: true,
      secondsVisible: false,
      rightOffsetPixels: TIME_SCALE_RIGHT_GAP_PX,
    },
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

type BtcChartsSuiteProps = {
  bars: OhlcvBar[]
  /** Velas 1d para SMA 200 diária (só quando o indicador está ligado). */
  dailyBarsForSma200?: OhlcvBar[]
  /** Velas 1w para Bull Market Support Band (só preenchido quando o indicador está ligado). */
  weeklyBarsForBand?: OhlcvBar[]
  /** Velas 1w para SMA 50 semanal. */
  weeklyBarsForSma50?: OhlcvBar[]
  bullBandLoading?: boolean
  sma200Loading?: boolean
  sma50Loading?: boolean
  resetKey?: number
}

export function BtcChartsSuite({
  bars,
  dailyBarsForSma200 = [],
  weeklyBarsForBand = [],
  weeklyBarsForSma50 = [],
  bullBandLoading = false,
  sma200Loading = false,
  sma50Loading = false,
  resetKey = 0,
}: BtcChartsSuiteProps) {
  const {
    mas,
    rsi: rsiCfg,
    macd: macdCfg,
    stoch: stochCfg,
    bollinger: bbCfg,
    zones: zonesCfg,
    candles,
    onChain,
    bullMarketBand,
    sma200Daily,
    sma50Weekly,
    timeframe,
  } = useBtcSettings()

  const wrapRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const rsiRef = useRef<HTMLDivElement>(null)
  const macdRef = useRef<HTMLDivElement>(null)
  const stochRef = useRef<HTMLDivElement>(null)
  const mvrvRef = useRef<HTMLDivElement>(null)
  const mvrvZRef = useRef<HTMLDivElement>(null)
  const soprRef = useRef<HTMLDivElement>(null)
  const nuplRef = useRef<HTMLDivElement>(null)

  const closes = useMemo(() => bars.map((b) => b.close), [bars])
  const highs = useMemo(() => bars.map((b) => b.high), [bars])
  const lows = useMemo(() => bars.map((b) => b.low), [bars])

  const rsiSeries = useMemo(
    () => (rsiCfg.enabled ? rsi(closes, rsiCfg.period) : null),
    [closes, rsiCfg.enabled, rsiCfg.period],
  )
  const macdOut = useMemo(
    () => (macdCfg.enabled ? macd(closes, macdCfg.fast, macdCfg.slow, macdCfg.signal) : null),
    [closes, macdCfg.enabled, macdCfg.fast, macdCfg.slow, macdCfg.signal],
  )
  const stochOut = useMemo(
    () =>
      stochCfg.enabled ? stochastic(highs, lows, closes, stochCfg.kPeriod, stochCfg.dPeriod, stochCfg.smooth) : null,
    [highs, lows, closes, stochCfg.enabled, stochCfg.kPeriod, stochCfg.dPeriod, stochCfg.smooth],
  )
  const bbSeries = useMemo(() => {
    if (!bbCfg.enabled || closes.length < bbCfg.period) return null
    return bollingerBands(closes, bbCfg.period, bbCfg.stdDev)
  }, [closes, bbCfg.enabled, bbCfg.period, bbCfg.stdDev])

  const sma200OnChart = useMemo(() => {
    if (!sma200Daily.enabled || dailyBarsForSma200.length < 200) return null
    return computeSma200OnDailyAligned(bars, dailyBarsForSma200)
  }, [sma200Daily.enabled, dailyBarsForSma200, bars])

  const bullBandOnChart = useMemo(() => {
    if (!bullMarketBand.enabled) return null
    return computeBullMarketBandOnChart(bars, weeklyBarsForBand)
  }, [bullMarketBand.enabled, weeklyBarsForBand, bars])

  const sma50OnChart = useMemo(() => {
    if (!sma50Weekly.enabled || weeklyBarsForSma50.length < 50) return null
    return computeSma50OnWeeklyAligned(bars, weeklyBarsForSma50)
  }, [sma50Weekly.enabled, weeklyBarsForSma50, bars])

  /** Pompx: gráfico mensal com velas Heikin Ashi quando a banda está ligada. */
  const candleBars = useMemo(() => {
    if (!bullMarketBand.enabled || timeframe.id !== '1M' || bars.length < 2) return bars
    return toHeikinAshi(bars).map((b) => ({
      time: b.time,
      open: b.haOpen,
      high: b.haHigh,
      low: b.haLow,
      close: b.haClose,
      volume: b.volume,
    }))
  }, [bars, bullMarketBand.enabled, timeframe.id])

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

  const mvrvData = useMemo(
    () => (onChain.mvrv.enabled ? syntheticMvrv(closes, onChain.mvrv.smaPeriod) : null),
    [closes, onChain.mvrv.enabled, onChain.mvrv.smaPeriod],
  )
  const mvrvForZ = useMemo(() => {
    if (!onChain.mvrvZ.enabled) return null
    return syntheticMvrv(closes, onChain.mvrv.smaPeriod)
  }, [closes, onChain.mvrvZ.enabled, onChain.mvrv.smaPeriod])
  const mvrvZData = useMemo(() => {
    if (!onChain.mvrvZ.enabled || !mvrvForZ) return null
    return syntheticMvrvZScore(mvrvForZ, onChain.mvrvZ.window)
  }, [onChain.mvrvZ.enabled, onChain.mvrvZ.window, mvrvForZ])

  const soprData = useMemo(
    () => (onChain.sopr.enabled ? syntheticSopr(closes, onChain.sopr.emaPeriod) : null),
    [closes, onChain.sopr.enabled, onChain.sopr.emaPeriod],
  )
  const nuplData = useMemo(
    () => (onChain.nupl.enabled ? syntheticNupl(closes, onChain.nupl.smaPeriod) : null),
    [closes, onChain.nupl.enabled, onChain.nupl.smaPeriod],
  )

  /** Últimos níveis USD das proxies STH/LTH (mesma lógica do gráfico) — para a barrinha abaixo do preço */
  const sthLthLevels = useMemo(() => {
    if (!onChain.sthLth.enabled || closes.length < 10) return null
    const st = onChain.sthLth
    const sthVals = ema(closes, st.rsiPeriod)
    const lthVals = sma(closes, st.smaPeriod)
    const i = closes.length - 1
    const sth = sthVals[i]
    const lth = lthVals[i]
    if (sth == null || lth == null) return null
    return { sth, lth }
  }, [closes, onChain.sthLth])

  const fmtUsdCompact = useMemo(
    () =>
      new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    [],
  )

  useEffect(() => {
    const wrap = wrapRef.current
    const elM = mainRef.current
    if (!wrap || !elM || bars.length < 10) return

    const charts: ReturnType<typeof createChart>[] = []

    const cMain = createChart(elM, {
      ...baseLayout(0, 0),
      autoSize: true,
    })
    charts.push(cMain)

    const { up, down, wickDown } = candles.colors
    const candle = cMain.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: wickDown,
    })
    candle.setData(
      candleBars.map((b) => ({ time: b.time as Time, open: b.open, high: b.high, low: b.low, close: b.close })),
    )

    cMain.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      color: 'rgba(212,175,55,0.25)',
    }).setData(
      bars.map((b) => ({
        time: b.time as Time,
        value: b.volume,
        color: b.close >= b.open ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.22)',
      })),
    )

    cMain.priceScale('').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } })
    cMain.priceScale('right').applyOptions({ scaleMargins: { top: 0.08, bottom: 0.18 } })

    mas.forEach((ma) => {
      const vals = movingAverage(closes, ma.period, ma.type)
      const lineData = bars
        .map((b, i) => ({ time: b.time as Time, value: vals[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
      if (!lineData.length) return
      cMain.addSeries(LineSeries, {
        color: ma.color,
        lineWidth: ma.lineWidth,
        priceLineVisible: false,
        lastValueVisible: true,
      }).setData(lineData)
    })

    if (sma200OnChart && sma200Daily.enabled) {
      const s200 = sma200Daily
      const smaLine = bars
        .map((b, i) => ({ time: b.time as Time, value: sma200OnChart[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
      if (smaLine.length) {
        cMain.addSeries(LineSeries, {
          color: s200.color,
          title: 'SMA 200 (Diário)',
          lineWidth: s200.lineWidth,
          priceLineVisible: false,
          lastValueVisible: true,
        }).setData(smaLine)
      }
    }

    if (sma50OnChart && sma50Weekly.enabled) {
      const s50 = sma50Weekly
      const smaLine = bars
        .map((b, i) => ({ time: b.time as Time, value: sma50OnChart[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
      if (smaLine.length) {
        cMain.addSeries(LineSeries, {
          color: s50.color,
          title: 'SMA 50 (Semanal)',
          lineWidth: s50.lineWidth,
          priceLineVisible: false,
          lastValueVisible: true,
        }).setData(smaLine)
      }
    }

    if (bullBandOnChart && bullMarketBand.enabled) {
      const bw = bullMarketBand
      const bandOpts = {
        priceLineVisible: false,
        lastValueVisible: true,
        lineWidth: bw.lineWidth,
      } as const
      const fillLineWidth = Math.min(4, bw.lineWidth + 1) as 1 | 2 | 3 | 4
      const fillLine = bars
        .map((b, i) => {
          const s = bullBandOnChart.sma[i]
          const e = bullBandOnChart.ema[i]
          if (s == null || e == null) return { time: b.time as Time, value: null }
          return { time: b.time as Time, value: (s + e) / 2 }
        })
        .filter((d): d is { time: Time; value: number } => d.value != null)
      const smaLine = bars
        .map((b, i) => ({ time: b.time as Time, value: bullBandOnChart.sma[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
      const emaLine = bars
        .map((b, i) => ({ time: b.time as Time, value: bullBandOnChart.ema[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
      if (fillLine.length) {
        cMain.addSeries(LineSeries, {
          color: `${bw.colorFill}99`,
          lineWidth: fillLineWidth,
          lineStyle: LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: false,
        }).setData(fillLine)
      }
      const bandLineWidth = Math.min(4, Math.max(bw.lineWidth, 2)) as 1 | 2 | 3 | 4
      if (smaLine.length) {
        cMain.addSeries(LineSeries, {
          ...bandOpts,
          color: bw.colorSma,
          title: `BMSB SMA ${BULL_MARKET_BAND_SMA_WEEKS}w`,
          lineWidth: bandLineWidth,
        }).setData(smaLine)
      }
      if (emaLine.length) {
        cMain.addSeries(LineSeries, {
          ...bandOpts,
          color: bw.colorEma,
          title: `BMSB EMA ${BULL_MARKET_BAND_EMA_WEEKS}w`,
          lineWidth: bandLineWidth,
        }).setData(emaLine)
      }
    }

    if (bbSeries) {
      const bOpts = { priceLineVisible: false, lastValueVisible: false, lineWidth: bbCfg.lineWidth }
      if (bbCfg.showUpper)
        cMain
          .addSeries(LineSeries, { color: bbCfg.colors.upper, lineStyle: LineStyle.Dotted, ...bOpts })
          .setData(
            bars
              .map((b, i) => ({ time: b.time as Time, value: bbSeries.upper[i] }))
              .filter((d): d is { time: Time; value: number } => d.value != null),
          )
      if (bbCfg.showMiddle)
        cMain
          .addSeries(LineSeries, { color: bbCfg.colors.middle, ...bOpts })
          .setData(
            bars
              .map((b, i) => ({ time: b.time as Time, value: bbSeries.middle[i] }))
              .filter((d): d is { time: Time; value: number } => d.value != null),
          )
      if (bbCfg.showLower)
        cMain
          .addSeries(LineSeries, { color: bbCfg.colors.lower, lineStyle: LineStyle.Dotted, ...bOpts })
          .setData(
            bars
              .map((b, i) => ({ time: b.time as Time, value: bbSeries.lower[i] }))
              .filter((d): d is { time: Time; value: number } => d.value != null),
          )
    }

    /** STH/LTH (proxy): no mesmo eixo do preço — EMA curta (comportamento “curto prazo”) vs SMA longa (“macro”). */
    if (onChain.sthLth.enabled) {
      const st = onChain.sthLth
      const sthVals = ema(closes, st.rsiPeriod)
      const lthVals = sma(closes, st.smaPeriod)
      cMain
        .addSeries(LineSeries, {
          color: st.colorSth,
          lineWidth: st.lineWidth,
          /** Linha horizontal no gráfico ao nível do último valor (nível “até onde vai” o STH proxy) */
          priceLineVisible: true,
          lastValueVisible: true,
        })
        .setData(
          bars
            .map((b, i) => ({ time: b.time as Time, value: sthVals[i] }))
            .filter((d): d is { time: Time; value: number } => d.value != null),
        )
      cMain
        .addSeries(LineSeries, {
          color: st.colorLth,
          lineWidth: st.lineWidth,
          priceLineVisible: true,
          lastValueVisible: true,
        })
        .setData(
          bars
            .map((b, i) => ({ time: b.time as Time, value: lthVals[i] }))
            .filter((d): d is { time: Time; value: number } => d.value != null),
        )
    }

    if (zonesCfg.enabled && zoneValues) {
      const { ma50v, ma100v, ma200v, recentHigh, recentLow } = zoneValues
      const anchor = cMain.addSeries(LineSeries, { visible: false, priceLineVisible: false, lastValueVisible: false })
      if (zonesCfg.showMaZones) {
        if (ma50v != null)
          anchor.createPriceLine({
            price: ma50v,
            color: BTC_CHART_THEME.zoneMa50,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'MA50',
          })
        if (ma100v != null)
          anchor.createPriceLine({
            price: ma100v,
            color: BTC_CHART_THEME.zoneMa100,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'MA100',
          })
        if (ma200v != null)
          anchor.createPriceLine({
            price: ma200v,
            color: BTC_CHART_THEME.zoneMa200,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'MA200',
          })
      }
      if (zonesCfg.showSupportResistance) {
        anchor.createPriceLine({
          price: recentHigh,
          color: BTC_CHART_THEME.zoneSupportResistance,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'Máx 50v',
        })
        anchor.createPriceLine({
          price: recentLow,
          color: BTC_CHART_THEME.zoneSupportResistance,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'Mín 50v',
        })
      }
      if (zonesCfg.showSmartMultipliers && zoneValues.ma200v != null) {
        const m200 = zoneValues.ma200v
        const zones = [
          { mult: 1.8, color: BTC_CHART_THEME.zoneExtremeTop, label: '×1.8' },
          { mult: 1.4, color: BTC_CHART_THEME.zoneWarning, label: '×1.4' },
          { mult: 1.0, color: BTC_CHART_THEME.zoneFairValue, label: '×1' },
          { mult: 0.8, color: BTC_CHART_THEME.zoneDiscount, label: '×0.8' },
          { mult: 0.6, color: BTC_CHART_THEME.zoneExtremeBottom, label: '×0.6' },
        ]
        zones.forEach(({ mult, color, label }) => {
          const price = m200 * mult
          if (price > 0)
            anchor.createPriceLine({
              price,
              color,
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: label,
            })
        })
      }
    }

    const subH = 92
    const chartW = Math.max(wrap.clientWidth, 200)

    const addOscillator = (
      el: HTMLDivElement | null,
      build: (chart: ReturnType<typeof createChart>) => void,
    ) => {
      if (!el) return
      const c = createChart(el, { ...baseLayout(chartW, subH) })
      charts.push(c)
      build(c)
    }

    if (rsiCfg.enabled && rsiSeries && rsiCfg.view === 'panel') {
      addOscillator(rsiRef.current, (cRsi) => {
        const line = cRsi.addSeries(LineSeries, {
          color: rsiCfg.colors.line,
          lineWidth: rsiCfg.lineWidth,
          priceLineVisible: false,
        })
        line.setData(
          bars.map((b, i) => ({ time: b.time as Time, value: rsiSeries[i] })).filter((d): d is { time: Time; value: number } => d.value != null),
        )
        cRsi.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } })
        if (rsiCfg.showLevels) {
          line.createPriceLine({
            price: rsiCfg.oversold,
            color: rsiCfg.colors.oversold,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: String(rsiCfg.oversold),
          })
          line.createPriceLine({
            price: rsiCfg.overbought,
            color: rsiCfg.colors.overbought,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: String(rsiCfg.overbought),
          })
        }
      })
    }

    if (macdCfg.enabled && macdOut) {
      addOscillator(macdRef.current, (cMacd) => {
        cMacd.addSeries(HistogramSeries, { priceFormat: { type: 'price', precision: 4, minMove: 0.0001 } }).setData(
          bars.map((b, i) => ({
            time: b.time as Time,
            value: macdOut.hist[i] ?? 0,
            color: (macdOut.hist[i] ?? 0) >= 0 ? BTC_CHART_THEME.macdHistogramPos : BTC_CHART_THEME.macdHistogramNeg,
          })),
        )
        cMacd
          .addSeries(LineSeries, { color: macdCfg.colors.line, lineWidth: macdCfg.lineWidth, priceLineVisible: false })
          .setData(bars.map((b, i) => ({ time: b.time as Time, value: macdOut.line[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
        cMacd
          .addSeries(LineSeries, { color: macdCfg.colors.signal, lineWidth: 1, priceLineVisible: false })
          .setData(bars.map((b, i) => ({ time: b.time as Time, value: macdOut.signal[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
      })
    }

    if (stochCfg.enabled && stochOut) {
      addOscillator(stochRef.current, (cStoch) => {
        cStoch
          .addSeries(LineSeries, { color: stochCfg.colors.k, lineWidth: stochCfg.lineWidth, priceLineVisible: false })
          .setData(bars.map((b, i) => ({ time: b.time as Time, value: stochOut.k[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
        cStoch
          .addSeries(LineSeries, { color: stochCfg.colors.d, lineWidth: 1, priceLineVisible: false })
          .setData(bars.map((b, i) => ({ time: b.time as Time, value: stochOut.d[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
      })
    }

    const addLinePane = (
      el: HTMLDivElement | null,
      data: (number | null)[] | null,
      color: string,
      lw: 1 | 2 | 3,
      extras?: (line: ReturnType<ReturnType<typeof createChart>['addSeries']>) => void,
    ) => {
      if (!el || !data) return
      addOscillator(el, (c) => {
        const line = c.addSeries(LineSeries, { color, lineWidth: lw, priceLineVisible: false })
        line.setData(bars.map((b, i) => ({ time: b.time as Time, value: data[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
        extras?.(line)
      })
    }

    if (onChain.mvrv.enabled && mvrvData) {
      addLinePane(mvrvRef.current, mvrvData, onChain.mvrv.color, onChain.mvrv.lineWidth, (line) => {
        line.createPriceLine({ price: 1, color: '#22c55e', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '1' })
        line.createPriceLine({ price: 2, color: '#a1a1aa', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '2' })
        line.createPriceLine({ price: 3, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '3' })
      })
    }

    if (onChain.mvrvZ.enabled && mvrvZData) {
      addLinePane(mvrvZRef.current, mvrvZData, onChain.mvrvZ.color, onChain.mvrvZ.lineWidth, (line) => {
        line.createPriceLine({ price: 0, color: '#71717a', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '0' })
        line.createPriceLine({ price: 2, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '+2' })
        line.createPriceLine({ price: -2, color: '#22c55e', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '−2' })
      })
    }

    if (onChain.sopr.enabled && soprData) {
      addLinePane(soprRef.current, soprData, onChain.sopr.color, onChain.sopr.lineWidth, (line) => {
        line.createPriceLine({ price: 1, color: '#71717a', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '1' })
      })
    }

    if (onChain.nupl.enabled && nuplData) {
      addOscillator(nuplRef.current, (c) => {
        const data = bars.map((b, i) => ({ time: b.time as Time, value: nuplData[i] })).filter((d): d is { time: Time; value: number } => d.value != null)
        if (onChain.nupl.style === 'area') {
          c.addSeries(AreaSeries, {
            lineColor: onChain.nupl.color,
            topColor: `${onChain.nupl.color}55`,
            bottomColor: `${onChain.nupl.color}08`,
            lineWidth: onChain.nupl.lineWidth,
          }).setData(data)
        } else {
          c.addSeries(LineSeries, {
            color: onChain.nupl.color,
            lineWidth: onChain.nupl.lineWidth,
            priceLineVisible: false,
          }).setData(data)
        }
        const ref = c.addSeries(LineSeries, {
          color: 'transparent',
          lineWidth: 0,
          priceLineVisible: false,
          lastValueVisible: false,
        })
        ref.setData(data)
        ref.createPriceLine({ price: 25, color: '#52525b', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false })
        ref.createPriceLine({ price: 45, color: '#52525b', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false })
        ref.createPriceLine({ price: 65, color: '#52525b', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false })
      })
    }

    syncCharts(charts)
    charts.forEach((c) => c.timeScale().fitContent())

    const ro = new ResizeObserver(() => {
      const nw = Math.max(wrap.clientWidth, 200)
      charts.slice(1).forEach((c) => c.applyOptions({ width: nw }))
    })
    ro.observe(wrap)

    return () => {
      ro.disconnect()
      charts.forEach((c) => c.remove())
    }
  }, [
    bars,
    closes,
    mas,
    rsiCfg,
    macdCfg,
    stochCfg,
    rsiSeries,
    macdOut,
    stochOut,
    bbSeries,
    bbCfg,
    zonesCfg,
    zoneValues,
    highs,
    lows,
    candles,
    onChain,
    mvrvData,
    mvrvZData,
    soprData,
    nuplData,
    resetKey,
    bullMarketBand,
    bullBandOnChart,
    sma200Daily,
    sma200OnChart,
    sma50Weekly,
    sma50OnChart,
    candleBars,
    timeframe.id,
  ])

  if (bars.length < 10) {
    return (
      <div className="flex min-h-[200px] flex-1 items-center justify-center rounded-lg border border-white/5 bg-[#050505] text-sm text-zinc-500">
        A carregar velas…
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      data-no-swipe-nav
      className="flex min-h-0 w-full flex-1 flex-col gap-0 overflow-hidden rounded-lg bg-[#050505]"
    >
      <div className="relative min-h-[200px] w-full min-w-0 flex-1 sm:min-h-[240px]">
        <div ref={mainRef} className="absolute inset-0" />
        {bullMarketBand.enabled && bullBandLoading && (
          <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-md border border-[#d4af37]/30 bg-black/80 px-2 py-1 text-[10px] text-[#d4af37]">
            A carregar Bull Market Band (dados semanais)…
          </div>
        )}
        {bullMarketBand.enabled && !bullBandLoading && !bullBandOnChart && (
          <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-md border border-amber-500/30 bg-black/80 px-2 py-1 text-[10px] text-amber-200/90">
            Sem dados semanais suficientes para a banda. Tenta BTC/USDT ou atualiza.
          </div>
        )}
        {sma200Daily.enabled && sma200Loading && (
          <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-md border border-amber-500/30 bg-black/80 px-2 py-1 text-[10px] text-amber-200/90">
            A carregar SMA 200 (dados diários)…
          </div>
        )}
        {sma200Daily.enabled && !sma200Loading && !sma200OnChart && (
          <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-md border border-amber-500/30 bg-black/80 px-2 py-1 text-[10px] text-amber-200/90">
            Sem dados diários suficientes para SMA 200. Usa intervalo Diário ou atualiza.
          </div>
        )}
        {sma50Weekly.enabled && sma50Loading && (
          <div className="pointer-events-none absolute left-2 top-9 z-10 rounded-md border border-sky-500/30 bg-black/80 px-2 py-1 text-[10px] text-sky-300">
            A carregar SMA 50 (dados semanais)…
          </div>
        )}
        {sma50Weekly.enabled && !sma50Loading && !sma50OnChart && (
          <div className="pointer-events-none absolute left-2 top-9 z-10 rounded-md border border-amber-500/30 bg-black/80 px-2 py-1 text-[10px] text-amber-200/90">
            Sem dados semanais suficientes para SMA 50. Tenta outro par ou atualiza.
          </div>
        )}
      </div>
      {onChain.sthLth.enabled && sthLthLevels && (
        <div className="border-t border-white/[0.06] px-2 py-2">
          <div className="mb-1.5 flex flex-wrap gap-2">
            <div
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-white/[0.08] bg-black/50 pl-2 pr-2.5 py-1.5"
              style={{ borderLeftWidth: 3, borderLeftColor: onChain.sthLth.colorSth }}
            >
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-500">STH</span>
              <span className="truncate font-mono text-xs tabular-nums text-zinc-100">{fmtUsdCompact.format(sthLthLevels.sth)}</span>
            </div>
            <div
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-white/[0.08] bg-black/50 pl-2 pr-2.5 py-1.5"
              style={{ borderLeftWidth: 3, borderLeftColor: onChain.sthLth.colorLth }}
            >
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-500">LTH</span>
              <span className="truncate font-mono text-xs tabular-nums text-zinc-100">{fmtUsdCompact.format(sthLthLevels.lth)}</span>
            </div>
          </div>
          <p className="text-[10px] leading-snug text-zinc-600">
            EMA({onChain.sthLth.rsiPeriod}) e SMA({onChain.sthLth.smaPeriod}) no gráfico acima — linhas horizontais marcam o último nível (USD). Proxies visuais, não dados de holders on-chain.
          </p>
        </div>
      )}

      {rsiCfg.enabled && rsiCfg.view === 'panel' && (
        <>
          <div className="border-t border-white/[0.06] px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            RSI ({rsiCfg.period})
          </div>
          <div ref={rsiRef} className="w-full shrink-0" />
        </>
      )}

      {macdCfg.enabled && (
        <>
          <div className="border-t border-white/[0.06] px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">MACD</div>
          <div ref={macdRef} className="w-full shrink-0" />
        </>
      )}

      {stochCfg.enabled && (
        <>
          <div className="border-t border-white/[0.06] px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Stochastic</div>
          <div ref={stochRef} className="w-full shrink-0" />
        </>
      )}

      {onChain.mvrv.enabled && (
        <>
          <div className="border-t border-white/[0.06] px-2 py-1 text-[10px] text-zinc-500">
            MVRV (proxy) · &lt;1 barato · &gt;3 caro
          </div>
          <div ref={mvrvRef} className="w-full shrink-0" />
        </>
      )}

      {onChain.mvrvZ.enabled && (
        <>
          <div className="border-t border-white/[0.06] px-2 py-1 text-[10px] text-zinc-500">MVRV Z-Score (proxy)</div>
          <div ref={mvrvZRef} className="w-full shrink-0" />
        </>
      )}

      {onChain.sopr.enabled && (
        <>
          <div className="border-t border-white/[0.06] px-2 py-1 text-[10px] text-zinc-500">SOPR (proxy) · ~1 neutro</div>
          <div ref={soprRef} className="w-full shrink-0" />
        </>
      )}

      {onChain.nupl.enabled && (
        <>
          <div className="border-t border-white/[0.06] px-2 py-1 text-[10px] text-zinc-500">NUPL (proxy) · 0–100</div>
          <div ref={nuplRef} className="w-full shrink-0" />
        </>
      )}
    </div>
  )
}
