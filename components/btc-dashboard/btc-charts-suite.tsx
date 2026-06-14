'use client'

import { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
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
import { buildFutureWhitespace } from '@/lib/btc/chart-whitespace'
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
import { buildOnChainChartOverlays, overlayAxisTitleShort } from '@/lib/btc/on-chain-overlays'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  ChartIndicatorLegend,
  type ChartLegendSettingsFocus,
} from '@/components/btc-dashboard/chart-indicator-legend'
import { ChartDrawingsLegend } from '@/components/btc-dashboard/chart-drawings-legend'
import { ChartIndicatorHitLayer } from '@/components/btc-dashboard/chart-indicator-hit-layer'
import { useChartIndicators } from '@/components/btc-dashboard/chart-indicators-context'
import { DrawingSystemOverlay } from '@/components/btc-dashboard/drawing-system-overlay'
import {
  resolveIndicatorLabelMode,
  seriesLabelFromMode,
} from '@/lib/btc/chart-indicator-display'
import { useChartDrawings } from '@/components/btc-dashboard/chart-drawings-context'
import type { GoldenCrossState } from '@/lib/btc/cycle-bottom'
import { computeOptimizedBtcSignals } from '@/lib/btc/signal-system'
import { getHigherTimeframeId, type TrendRadarAnalysis } from '@/lib/btc/trend-radar'
import { TrendRadarOverlay } from '@/components/btc-dashboard/trend-radar-overlay'
import { CYCLE_BOTTOM_INDICATORS } from '@/lib/btc/cycle-bottom-config'
import {
  computeBullMarketBandOnChart,
  computeSma200OnDailyAligned,
  computeSma50OnDailyAligned,
  computeSma50OnWeeklyAligned,
} from '@/lib/btc/cycle-bottom'
import { toHeikinAshi } from '@/lib/btc/heikin-ashi'
import {
  BULL_MARKET_BAND_EMA_WEEKS,
  BULL_MARKET_BAND_SMA_WEEKS,
  type OhlcvBar,
  TIMEFRAME_PRESETS,
} from '@/lib/btc/types'

const BG = '#050505'
const GRID = '#1a1a1a'
const TEXT = '#d4d4d8'

function baseLayout(width: number, height: number, compact = false) {
  return {
    width,
    height,
    layout: {
      background: { type: ColorType.Solid, color: BG },
      textColor: TEXT,
      fontSize: compact ? 10 : 11,
      attributionLogo: false,
    },
    grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: {
      borderColor: '#27272a',
      /** Largura mínima para caber preço BTC (ex. 67258.80) no mobile. */
      minimumWidth: compact ? 52 : undefined,
    },
    timeScale: {
      borderColor: '#27272a',
      timeVisible: true,
      secondsVisible: false,
      rightOffsetPixels: compact ? 36 : 18,
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
  /** Velas 1d para Golden Cross (SMA 50 + 200 diárias). */
  dailyBarsForGoldenCross?: OhlcvBar[]
  goldenCrossLoading?: boolean
  goldenCrossState?: GoldenCrossState
  htfBarsForTrendRadar?: OhlcvBar[]
  onOpenIndicatorSettings?: (focus: ChartLegendSettingsFocus) => void
  /** Só preço + indicadores de ciclo (modo ecrã inteiro). */
  priceOnlyFocus?: boolean
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
  dailyBarsForGoldenCross = [],
  goldenCrossLoading = false,
  goldenCrossState,
  htfBarsForTrendRadar = [],
  onOpenIndicatorSettings,
  priceOnlyFocus = false,
  resetKey = 0,
}: BtcChartsSuiteProps) {
  const {
    mas,
    removeMa,
    rsi: rsiCfg,
    macd: macdCfg,
    stoch: stochCfg,
    bollinger: bbCfg,
    zones: zonesCfg,
    candles,
    onChain,
    setOnChain,
    bullMarketBand,
    setBullMarketBand,
    sma200Daily,
    setSma200Daily,
    sma50Weekly,
    setSma50Weekly,
    goldenCrossDaily,
    setGoldenCrossDaily,
    trendRadar,
    chartIndicatorDisplay,
    timeframe,
  } = useBtcSettings()

  const focusPrice = priceOnlyFocus
  const { registerMainChart } = useChartDrawings()
  const { setTargets } = useChartIndicators()

  const wrapRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const mainChartRef = useRef<IChartApi | null>(null)
  const rsiRef = useRef<HTMLDivElement>(null)
  const macdRef = useRef<HTMLDivElement>(null)
  const stochRef = useRef<HTMLDivElement>(null)
  const closes = useMemo(() => bars.map((b) => b.close), [bars])

  const isPhone = useIsMobile()
  const indicatorLabel = (id: string, fullTitle: string) =>
    seriesLabelFromMode(resolveIndicatorLabelMode(id, chartIndicatorDisplay), fullTitle, isPhone)
  const showSubPanels = !focusPrice
  const oscHeight = isPhone ? 68 : 92

  const onChainOverlays = useMemo(
    () => (!focusPrice ? buildOnChainChartOverlays(closes, onChain) : []),
    [closes, onChain, focusPrice],
  )
  const highs = useMemo(() => bars.map((b) => b.high), [bars])
  const lows = useMemo(() => bars.map((b) => b.low), [bars])

  const trendRadarAnalysis = useMemo((): TrendRadarAnalysis | null => {
    if (!trendRadar.enabled || bars.length < 55) return null
    const htfId = getHigherTimeframeId(timeframe.id)
    const htfLabel = TIMEFRAME_PRESETS.find((t) => t.id === htfId)?.label ?? htfId
    return computeOptimizedBtcSignals(
      bars,
      htfBarsForTrendRadar.length >= 25 ? htfBarsForTrendRadar : undefined,
      { chartLabel: timeframe.label, htfLabel, optimize: bars.length >= 80 },
    )
  }, [trendRadar.enabled, bars, htfBarsForTrendRadar, timeframe.id, timeframe.label])

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

  const showRsiPanel =
    showSubPanels && rsiCfg.enabled && rsiSeries != null && rsiCfg.view === 'panel'
  const showMacdPanel = showSubPanels && macdCfg.enabled && macdOut != null
  const showStochPanel = showSubPanels && stochCfg.enabled && stochOut != null
  const oscillatorCount = [showRsiPanel, showMacdPanel, showStochPanel].filter(Boolean).length
  const hasSthLthBar = showSubPanels && onChain.sthLth.enabled
  const hasOscillatorStack = oscillatorCount > 0 || hasSthLthBar

  const bbSeries = useMemo(() => {
    if (!bbCfg.enabled || closes.length < bbCfg.period) return null
    return bollingerBands(closes, bbCfg.period, bbCfg.stdDev)
  }, [closes, bbCfg.enabled, bbCfg.period, bbCfg.stdDev])

  const sma200OnChart = useMemo(() => {
    if (!sma200Daily.enabled || goldenCrossDaily.enabled || dailyBarsForSma200.length < 200) return null
    return computeSma200OnDailyAligned(bars, dailyBarsForSma200)
  }, [sma200Daily.enabled, goldenCrossDaily.enabled, dailyBarsForSma200, bars])

  const goldenSma50OnChart = useMemo(() => {
    if (!goldenCrossDaily.enabled || dailyBarsForGoldenCross.length < 50) return null
    return computeSma50OnDailyAligned(bars, dailyBarsForGoldenCross)
  }, [goldenCrossDaily.enabled, dailyBarsForGoldenCross, bars])

  const goldenSma200OnChart = useMemo(() => {
    if (!goldenCrossDaily.enabled || dailyBarsForGoldenCross.length < 200) return null
    return computeSma200OnDailyAligned(bars, dailyBarsForGoldenCross)
  }, [goldenCrossDaily.enabled, dailyBarsForGoldenCross, bars])

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

  const sthValsForChart = useMemo(
    () => (onChain.sthLth.enabled ? ema(closes, onChain.sthLth.rsiPeriod) : null),
    [closes, onChain.sthLth.enabled, onChain.sthLth.rsiPeriod],
  )
  const lthValsForChart = useMemo(
    () => (onChain.sthLth.enabled ? sma(closes, onChain.sthLth.smaPeriod) : null),
    [closes, onChain.sthLth.enabled, onChain.sthLth.smaPeriod],
  )

  const indicatorRegistry = useMemo(() => {
    const list: Parameters<typeof setTargets>[0] = []

    if (goldenCrossDaily.enabled && goldenSma50OnChart) {
      list.push({
        id: 'goldenSma50',
        label: 'SMA 50 (Diário)',
        colors: [goldenCrossDaily.colorSma50],
        values: goldenSma50OnChart,
        settingsFocus: 'cycle',
        onRemove: () => setGoldenCrossDaily({ ...goldenCrossDaily, enabled: false }),
      })
    }
    if (goldenCrossDaily.enabled && goldenSma200OnChart) {
      list.push({
        id: 'goldenSma200',
        label: 'SMA 200 (Diário)',
        colors: [goldenCrossDaily.colorSma200],
        values: goldenSma200OnChart,
        settingsFocus: 'cycle',
        onRemove: () => setGoldenCrossDaily({ ...goldenCrossDaily, enabled: false }),
      })
    }
    if (sma200OnChart && sma200Daily.enabled && !goldenCrossDaily.enabled) {
      const meta = CYCLE_BOTTOM_INDICATORS.find((m) => m.id === 'sma200')
      list.push({
        id: 'sma200',
        label: `SMA 200 (${meta?.timeframeLabel ?? 'Diário'})`,
        colors: [sma200Daily.color],
        values: sma200OnChart,
        settingsFocus: 'cycle',
        onRemove: () => setSma200Daily({ ...sma200Daily, enabled: false }),
      })
    }
    if (sma50OnChart && sma50Weekly.enabled) {
      const meta = CYCLE_BOTTOM_INDICATORS.find((m) => m.id === 'sma50w')
      list.push({
        id: 'sma50w',
        label: `SMA 50 (${meta?.timeframeLabel ?? 'Semanal'})`,
        colors: [sma50Weekly.color],
        values: sma50OnChart,
        settingsFocus: 'cycle',
        onRemove: () => setSma50Weekly({ ...sma50Weekly, enabled: false }),
      })
    }
    if (bullBandOnChart) {
      list.push({
        id: 'bmsb-sma',
        label: `BMSB SMA ${BULL_MARKET_BAND_SMA_WEEKS}w`,
        colors: [bullMarketBand.colorSma],
        values: bullBandOnChart.sma,
        settingsFocus: 'cycle',
        onRemove: () => setBullMarketBand({ ...bullMarketBand, enabled: false }),
      })
      list.push({
        id: 'bmsb-ema',
        label: `BMSB EMA ${BULL_MARKET_BAND_EMA_WEEKS}w`,
        colors: [bullMarketBand.colorEma],
        values: bullBandOnChart.ema,
        settingsFocus: 'cycle',
        onRemove: () => setBullMarketBand({ ...bullMarketBand, enabled: false }),
      })
    }
    if (!focusPrice) {
      mas.forEach((ma) => {
        list.push({
          id: `ma-${ma.id}`,
          label: `${ma.type} ${ma.period}`,
          colors: [ma.color],
          values: movingAverage(closes, ma.period, ma.type),
          settingsFocus: 'moving-averages',
          onRemove: () => removeMa(ma.id),
        })
      })
    }
    if (!focusPrice && sthValsForChart && lthValsForChart && onChain.sthLth.enabled) {
      list.push({
        id: 'sthLth-sth',
        label: 'STH/LTH (STH)',
        colors: [onChain.sthLth.colorSth],
        values: sthValsForChart,
        settingsFocus: 'on-chain',
        onRemove: () => setOnChain((p) => ({ ...p, sthLth: { ...p.sthLth, enabled: false } })),
      })
      list.push({
        id: 'sthLth-lth',
        label: 'STH/LTH (LTH)',
        colors: [onChain.sthLth.colorLth],
        values: lthValsForChart,
        settingsFocus: 'on-chain',
        onRemove: () => setOnChain((p) => ({ ...p, sthLth: { ...p.sthLth, enabled: false } })),
      })
    }
    return list
  }, [
    goldenCrossDaily,
    setGoldenCrossDaily,
    goldenSma50OnChart,
    goldenSma200OnChart,
    sma200OnChart,
    sma200Daily,
    setSma200Daily,
    sma50OnChart,
    sma50Weekly,
    setSma50Weekly,
    bullBandOnChart,
    bullMarketBand,
    setBullMarketBand,
    mas,
    removeMa,
    closes,
    focusPrice,
    sthValsForChart,
    lthValsForChart,
    onChain.sthLth,
    setOnChain,
  ])

  useEffect(() => {
    setTargets(indicatorRegistry)
  }, [indicatorRegistry, setTargets])

  useEffect(() => {
    const wrap = wrapRef.current
    const elM = mainRef.current
    if (!wrap || !elM || bars.length < 10) return

    const charts: ReturnType<typeof createChart>[] = []

    const cMain = createChart(elM, {
      ...baseLayout(0, 0, isPhone),
      autoSize: true,
    })
    charts.push(cMain)
    mainChartRef.current = cMain

    const { up, down, wickDown } = candles.colors
    const candle = cMain.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: wickDown,
      priceLineVisible: false,
      lastValueVisible: true,
    })
    registerMainChart({ chart: cMain, series: candle, container: elM })
    const candleData = candleBars.map((b) => ({
      time: b.time as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }))
    candle.setData([...candleData, ...buildFutureWhitespace(candleBars)])

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
    cMain.priceScale('right').applyOptions({
      scaleMargins: { top: 0.08, bottom: 0.12 },
      autoScale: true,
    })

    for (const ov of onChainOverlays) {
      candle.createPriceLine({
        price: ov.price,
        color: ov.color,
        lineWidth: ov.lineWidth,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: !isPhone,
        title: isPhone ? '' : overlayAxisTitleShort(ov),
      })
    }

    mas.forEach((ma) => {
      if (focusPrice) return
      const vals = movingAverage(closes, ma.period, ma.type)
      const lineData = bars
        .map((b, i) => ({ time: b.time as Time, value: vals[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
      if (!lineData.length) return
      const fullTitle = `${ma.type} ${ma.period}`
      const lbl = indicatorLabel(`ma-${ma.id}`, fullTitle)
      cMain.addSeries(LineSeries, {
        color: ma.color,
        title: lbl.title,
        lineWidth: ma.lineWidth,
        priceLineVisible: lbl.priceLineVisible,
        lastValueVisible: lbl.lastValueVisible,
      }).setData(lineData)
    })

    if (!focusPrice && sma200OnChart && sma200Daily.enabled) {
      const s200 = sma200Daily
      const smaLine = bars
        .map((b, i) => ({ time: b.time as Time, value: sma200OnChart[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
      if (smaLine.length) {
        const meta = CYCLE_BOTTOM_INDICATORS.find((m) => m.id === 'sma200')
        const fullTitle = `SMA 200 (${meta?.timeframeLabel ?? 'Diário'})`
        const lbl = indicatorLabel('sma200', fullTitle)
        cMain.addSeries(LineSeries, {
          color: s200.color,
          title: lbl.title,
          lineWidth: s200.lineWidth,
          priceLineVisible: lbl.priceLineVisible,
          lastValueVisible: lbl.lastValueVisible,
        }).setData(smaLine)
      }
    }

    if (!focusPrice && sma50OnChart && sma50Weekly.enabled) {
      const s50 = sma50Weekly
      const smaLine = bars
        .map((b, i) => ({ time: b.time as Time, value: sma50OnChart[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
      if (smaLine.length) {
        const meta = CYCLE_BOTTOM_INDICATORS.find((m) => m.id === 'sma50w')
        const fullTitle = `SMA 50 (${meta?.timeframeLabel ?? 'Semanal'})`
        const lbl = indicatorLabel('sma50w', fullTitle)
        cMain.addSeries(LineSeries, {
          color: s50.color,
          title: lbl.title,
          lineWidth: s50.lineWidth,
          priceLineVisible: lbl.priceLineVisible,
          lastValueVisible: lbl.lastValueVisible,
        }).setData(smaLine)
      }
    }

    if (goldenSma50OnChart && goldenCrossDaily.enabled) {
      const gc = goldenCrossDaily
      const line50 = bars
        .map((b, i) => ({ time: b.time as Time, value: goldenSma50OnChart[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
      if (line50.length) {
        const lbl = indicatorLabel('goldenSma50', 'SMA 50 (Diário)')
        cMain.addSeries(LineSeries, {
          color: gc.colorSma50,
          title: lbl.title,
          lineWidth: gc.lineWidth,
          priceLineVisible: lbl.priceLineVisible,
          lastValueVisible: lbl.lastValueVisible,
        }).setData(line50)
      }
    }

    if (goldenSma200OnChart && goldenCrossDaily.enabled) {
      const gc = goldenCrossDaily
      const line200 = bars
        .map((b, i) => ({ time: b.time as Time, value: goldenSma200OnChart[i] }))
        .filter((d): d is { time: Time; value: number } => d.value != null)
      if (line200.length) {
        const lbl = indicatorLabel('goldenSma200', 'SMA 200 (Diário)')
        cMain.addSeries(LineSeries, {
          color: gc.colorSma200,
          title: lbl.title,
          lineWidth: gc.lineWidth,
          priceLineVisible: lbl.priceLineVisible,
          lastValueVisible: lbl.lastValueVisible,
        }).setData(line200)
      }
    }

    if (!focusPrice && bullBandOnChart && bullMarketBand.enabled) {
      const bw = bullMarketBand
      const smaTitle = `BMSB SMA ${BULL_MARKET_BAND_SMA_WEEKS}w`
      const emaTitle = `BMSB EMA ${BULL_MARKET_BAND_EMA_WEEKS}w`
      const lblSma = indicatorLabel('bmsb-sma', smaTitle)
      const lblEma = indicatorLabel('bmsb-ema', emaTitle)
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
          color: bw.colorSma,
          title: lblSma.title,
          lineWidth: bandLineWidth,
          priceLineVisible: lblSma.priceLineVisible,
          lastValueVisible: lblSma.lastValueVisible,
        }).setData(smaLine)
      }
      if (emaLine.length) {
        cMain.addSeries(LineSeries, {
          color: bw.colorEma,
          title: lblEma.title,
          lineWidth: bandLineWidth,
          priceLineVisible: lblEma.priceLineVisible,
          lastValueVisible: lblEma.lastValueVisible,
        }).setData(emaLine)
      }
    }

    if (!focusPrice && bbSeries) {
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
          .addSeries(LineSeries, {
            color: bbCfg.colors.middle,
            title: `Bollinger ${bbCfg.period}`,
            ...bOpts,
          })
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
    if (!focusPrice && onChain.sthLth.enabled) {
      const st = onChain.sthLth
      const sthVals = ema(closes, st.rsiPeriod)
      const lthVals = sma(closes, st.smaPeriod)
      const lblSth = indicatorLabel('sthLth-sth', 'STH/LTH (STH)')
      const lblLth = indicatorLabel('sthLth-lth', 'STH/LTH (LTH)')
      cMain
        .addSeries(LineSeries, {
          color: st.colorSth,
          title: lblSth.title,
          lineWidth: st.lineWidth,
          priceLineVisible: lblSth.priceLineVisible,
          lastValueVisible: lblSth.lastValueVisible,
        })
        .setData(
          bars
            .map((b, i) => ({ time: b.time as Time, value: sthVals[i] }))
            .filter((d): d is { time: Time; value: number } => d.value != null),
        )
      cMain
        .addSeries(LineSeries, {
          color: st.colorLth,
          title: lblLth.title,
          lineWidth: st.lineWidth,
          priceLineVisible: lblLth.priceLineVisible,
          lastValueVisible: lblLth.lastValueVisible,
        })
        .setData(
          bars
            .map((b, i) => ({ time: b.time as Time, value: lthVals[i] }))
            .filter((d): d is { time: Time; value: number } => d.value != null),
        )
    }

    if (!focusPrice && zonesCfg.enabled && zoneValues) {
      const { ma50v, ma100v, ma200v, recentHigh, recentLow } = zoneValues
      const anchor = cMain.addSeries(LineSeries, { visible: false, priceLineVisible: false, lastValueVisible: false })
      if (zonesCfg.showMaZones) {
        if (ma50v != null)
          anchor.createPriceLine({
            price: ma50v,
            color: BTC_CHART_THEME.zoneMa50,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: !isPhone,
            title: 'MA50',
          })
        if (ma100v != null)
          anchor.createPriceLine({
            price: ma100v,
            color: BTC_CHART_THEME.zoneMa100,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: !isPhone,
            title: 'MA100',
          })
        if (ma200v != null)
          anchor.createPriceLine({
            price: ma200v,
            color: BTC_CHART_THEME.zoneMa200,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: !isPhone,
            title: 'MA200',
          })
      }
      if (zonesCfg.showSupportResistance) {
        anchor.createPriceLine({
          price: recentHigh,
          color: BTC_CHART_THEME.zoneSupportResistance,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: !isPhone,
          title: isPhone ? '' : 'Máx 50v',
        })
        anchor.createPriceLine({
          price: recentLow,
          color: BTC_CHART_THEME.zoneSupportResistance,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: !isPhone,
          title: isPhone ? '' : 'Mín 50v',
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
              axisLabelVisible: !isPhone,
              title: isPhone ? '' : label,
            })
        })
      }
    }

    const subH = oscHeight
    const chartW = Math.max(wrap.clientWidth, 200)

    const addOscillator = (
      el: HTMLDivElement | null,
      build: (chart: ReturnType<typeof createChart>) => void,
    ) => {
      if (!el) return
      const c = createChart(el, { ...baseLayout(chartW, subH, isPhone) })
      charts.push(c)
      build(c)
    }

    if (showRsiPanel && rsiSeries) {
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
            axisLabelVisible: !isPhone,
            title: String(rsiCfg.oversold),
          })
          line.createPriceLine({
            price: rsiCfg.overbought,
            color: rsiCfg.colors.overbought,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: !isPhone,
            title: String(rsiCfg.overbought),
          })
        }
      })
    }

    if (showMacdPanel && macdOut) {
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

    if (showStochPanel && stochOut) {
      addOscillator(stochRef.current, (cStoch) => {
        cStoch
          .addSeries(LineSeries, { color: stochCfg.colors.k, lineWidth: stochCfg.lineWidth, priceLineVisible: false })
          .setData(bars.map((b, i) => ({ time: b.time as Time, value: stochOut.k[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
        cStoch
          .addSeries(LineSeries, { color: stochCfg.colors.d, lineWidth: 1, priceLineVisible: false })
          .setData(bars.map((b, i) => ({ time: b.time as Time, value: stochOut.d[i] })).filter((d): d is { time: Time; value: number } => d.value != null))
      })
    }

    syncCharts(charts)
    charts.forEach((c) => c.timeScale().fitContent())

    const ro = new ResizeObserver(() => {
      const nw = Math.max(wrap.clientWidth, 200)
      charts.slice(1).forEach((c) => c.applyOptions({ width: nw, height: subH }))
    })
    ro.observe(wrap)

    return () => {
      ro.disconnect()
      charts.forEach((c) => c.remove())
      mainChartRef.current = null
      registerMainChart(null)
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
    onChainOverlays,
    showRsiPanel,
    showMacdPanel,
    showStochPanel,
    oscHeight,
    resetKey,
    bullMarketBand,
    bullBandOnChart,
    sma200Daily,
    sma200OnChart,
    sma50Weekly,
    sma50OnChart,
    goldenCrossDaily,
    goldenSma50OnChart,
    goldenSma200OnChart,
    focusPrice,
    candleBars,
    timeframe.id,
    registerMainChart,
    isPhone,
    chartIndicatorDisplay,
  ])

  useEffect(() => {
    const onZoom = (ev: Event) => {
      const chart = mainChartRef.current
      if (!chart) return
      const direction = (ev as CustomEvent<{ direction: 'in' | 'out' }>).detail?.direction
      if (direction !== 'in' && direction !== 'out') return
      const ts = chart.timeScale()
      const range = ts.getVisibleLogicalRange()
      if (!range) return
      const span = range.to - range.from
      const center = (range.from + range.to) / 2
      const factor = direction === 'in' ? 0.72 : 1.28
      const newSpan = Math.max(12, span * factor)
      ts.setVisibleLogicalRange({ from: center - newSpan / 2, to: center + newSpan / 2 })
    }
    window.addEventListener('yieldscan:chart-zoom', onZoom)
    return () => window.removeEventListener('yieldscan:chart-zoom', onZoom)
  }, [])

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
      className={cn(
        'flex min-h-0 w-full flex-1 flex-col gap-0 rounded-lg bg-[#050505]',
        isPhone && hasOscillatorStack ? 'overflow-y-auto overscroll-y-contain' : 'overflow-hidden',
      )}
    >
      <div
        className={cn(
          'relative w-full min-w-0',
          isPhone && hasOscillatorStack
            ? 'h-[min(54dvh,380px)] shrink-0'
            : 'min-h-[220px] flex-1 sm:min-h-[240px]',
          focusPrice && isPhone && 'min-h-0',
        )}
      >
        <div ref={mainRef} className="yieldscan-chart-root absolute inset-0" />
        <DrawingSystemOverlay bars={bars} />
        <TrendRadarOverlay analysis={trendRadarAnalysis} settings={trendRadar} bars={bars} barsCount={bars.length} />
        <ChartIndicatorHitLayer bars={bars} onOpenSettings={onOpenIndicatorSettings} />
        <ChartDrawingsLegend />
        <ChartIndicatorLegend
          goldenCrossState={goldenCrossState}
          onOpenSettings={onOpenIndicatorSettings}
          className={isPhone ? 'bottom-auto left-1.5 top-1.5 max-w-[min(42%,9.5rem)]' : undefined}
        />
        {bullMarketBand.enabled && bullBandLoading && (
          <div className="pointer-events-none absolute left-2 top-24 z-10 rounded-md border border-[#d4af37]/30 bg-black/80 px-2 py-1 text-[10px] text-[#d4af37]">
            A carregar Bull Market Band (dados semanais)…
          </div>
        )}
        {bullMarketBand.enabled && !bullBandLoading && !bullBandOnChart && (
          <div className="pointer-events-none absolute left-2 top-24 z-10 rounded-md border border-amber-500/30 bg-black/80 px-2 py-1 text-[10px] text-amber-200/90">
            Sem dados semanais suficientes para a banda. Tenta BTC/USDT ou atualiza.
          </div>
        )}
        {sma200Daily.enabled && sma200Loading && (
          <div className="pointer-events-none absolute left-2 top-24 z-10 rounded-md border border-amber-500/30 bg-black/80 px-2 py-1 text-[10px] text-amber-200/90">
            A carregar SMA 200 (dados diários)…
          </div>
        )}
        {sma200Daily.enabled && !sma200Loading && !sma200OnChart && (
          <div className="pointer-events-none absolute left-2 top-24 z-10 rounded-md border border-amber-500/30 bg-black/80 px-2 py-1 text-[10px] text-amber-200/90">
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
        {goldenCrossDaily.enabled && goldenCrossLoading && (
          <div
            className={cn(
              'pointer-events-none absolute left-2 z-10 rounded-md border border-cyan-500/30 bg-black/80 px-2 py-1 text-[10px] text-cyan-300',
              focusPrice && isPhone ? 'bottom-2 top-auto max-w-[85%]' : 'top-24',
            )}
          >
            A carregar Golden / Death Cross (dados diários)…
          </div>
        )}
        {goldenCrossDaily.enabled &&
          !goldenCrossLoading &&
          (!goldenSma50OnChart || !goldenSma200OnChart) && (
            <div
              className={cn(
                'pointer-events-none absolute left-2 z-10 rounded-md border border-amber-500/30 bg-black/80 px-2 py-1 text-[10px] text-amber-200/90',
                focusPrice && isPhone ? 'bottom-2 top-auto max-w-[85%]' : 'top-32',
              )}
            >
              Sem dados diários suficientes para SMA 50 e 200. Usa Diário ou atualiza.
            </div>
          )}
      </div>
      {hasSthLthBar && sthLthLevels && (
        <div className="shrink-0 border-t border-white/[0.06] px-2 py-1.5">
          <div className="mb-1 flex flex-wrap gap-1.5">
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
          {!isPhone && (
            <p className="text-[10px] leading-snug text-zinc-600">
              EMA({onChain.sthLth.rsiPeriod}) e SMA({onChain.sthLth.smaPeriod}) no gráfico acima — linhas horizontais marcam o último nível (USD). Proxies visuais, não dados de holders on-chain.
            </p>
          )}
        </div>
      )}

      {showRsiPanel && (
        <div className="shrink-0 border-t border-white/[0.06]">
          <div className="px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-500 sm:py-1 sm:text-[10px]">
            RSI ({rsiCfg.period})
          </div>
          <div ref={rsiRef} className="w-full shrink-0" style={{ height: oscHeight }} />
        </div>
      )}

      {showMacdPanel && (
        <div className="shrink-0 border-t border-white/[0.06]">
          <div className="px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-500 sm:py-1 sm:text-[10px]">
            MACD
          </div>
          <div ref={macdRef} className="w-full shrink-0" style={{ height: oscHeight }} />
        </div>
      )}

      {showStochPanel && (
        <div className="shrink-0 border-t border-white/[0.06]">
          <div className="px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-500 sm:py-1 sm:text-[10px]">
            Stochastic
          </div>
          <div ref={stochRef} className="w-full shrink-0" style={{ height: oscHeight }} />
        </div>
      )}

      {showSubPanels && onChainOverlays.length > 0 && !isPhone && (
        <div className="shrink-0 border-t border-white/[0.06] px-2 py-1.5 sm:py-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            On-chain no gráfico de preço
          </p>
          <div className="flex flex-wrap gap-1.5">
            {onChainOverlays.map((ov) => (
              <span
                key={ov.id}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-white/[0.08] bg-black/50 px-2 py-1 text-[10px] text-zinc-300"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ov.color }} />
                <span className="truncate font-medium">{overlayAxisTitleShort(ov)}</span>
                <span className="font-mono tabular-nums text-zinc-500">
                  {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(ov.price)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
