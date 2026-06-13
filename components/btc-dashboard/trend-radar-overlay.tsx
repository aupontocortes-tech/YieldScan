'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useChartDrawings } from '@/components/btc-dashboard/chart-drawings-context'
import type { MainChartApi } from '@/lib/btc/chart-drawing-types'
import { ema } from '@/lib/btc/indicators'
import type { TrendRadarAnalysis } from '@/lib/btc/trend-radar'
import type { OhlcvBar, TrendRadarSettings } from '@/lib/btc/types'
import { cn } from '@/lib/utils'
import { Brain, Radar } from 'lucide-react'

type Props = {
  analysis: TrendRadarAnalysis | null
  settings: TrendRadarSettings
  bars?: OhlcvBar[]
  barsCount?: number
}


function fmtPoc(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

type Tone = 'bull' | 'bear' | 'neutral' | 'warn'

function toneClass(tone: Tone): string {
  if (tone === 'bull') return 'text-emerald-400'
  if (tone === 'bear') return 'text-red-400'
  if (tone === 'warn') return 'text-amber-400'
  return 'text-zinc-300'
}

function displayTone(key: keyof TrendRadarAnalysis['display'], value: string): Tone {
  if (value === '—') return 'neutral'
  if (key === 'volume') {
    if (value === 'FORTE') return 'bull'
    if (value === 'FRACO') return 'bear'
    return 'neutral'
  }
  if (key === 'macd') {
    if (value === 'ALTA') return 'bull'
    if (value === 'BAIXA') return 'bear'
    return 'neutral'
  }
  if (key === 'htf') {
    if (value === 'ALTA') return 'bull'
    if (value === 'QUEDA') return 'bear'
    return 'neutral'
  }
  if (key === 'rsi') {
    if (value === 'SOBREVENDA') return 'bull'
    if (value === 'SOBRECOMPRA') return 'bear'
    return 'neutral'
  }
  return 'neutral'
}

function qualityTone(label: string): Tone {
  if (label === 'MUITO FORTE' || label === 'FORTE') return 'bull'
  if (label === 'MODERADO') return 'warn'
  return 'bear'
}

function InstRow({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-[5px] last:border-0">
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <span className={cn('font-mono text-[11px] font-semibold tabular-nums', toneClass(tone))}>{value}</span>
    </div>
  )
}

export function TrendRadarPanel({ analysis, settings }: Props) {
  if (!settings.enabled || !settings.showPanel || !analysis) return null

  const decision =
    analysis.signal === 'buy' ? 'BUY' : analysis.signal === 'sell' ? 'SELL' : 'AGUARDAR'

  const decisionBg =
    analysis.signal === 'buy'
      ? 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700'
      : analysis.signal === 'sell'
        ? 'bg-gradient-to-r from-red-800 via-red-600 to-red-800'
        : 'bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800'

  return (
    <div
      className="pointer-events-none absolute right-2 top-12 z-20 w-[min(100%,12.75rem)] overflow-hidden rounded-lg border border-white/12 bg-[#0a0a0a]/92 shadow-[0_8px_32px_rgba(0,0,0,0.65)] backdrop-blur-sm sm:right-3 sm:top-14 sm:w-[13.25rem]"
      aria-label="Painel Radar IA"
    >
      <div className="px-3 pt-2.5 pb-1">
        <InstRow
          label="Qualidade do Sinal"
          value={analysis.qualityLabel}
          tone={qualityTone(analysis.qualityLabel)}
        />
        <InstRow
          label="ADX"
          value={analysis.adx != null ? analysis.adx.toFixed(1) : '—'}
          tone={analysis.criteria.adx ? 'bull' : 'neutral'}
        />
        <InstRow label="RSI" value={analysis.display.rsi} tone={displayTone('rsi', analysis.display.rsi)} />
        <InstRow
          label="Volume"
          value={analysis.display.volume}
          tone={displayTone('volume', analysis.display.volume)}
        />
        <InstRow label="HTF" value={analysis.display.htf} tone={displayTone('htf', analysis.display.htf)} />
        <InstRow label="MACD" value={analysis.display.macd} tone={displayTone('macd', analysis.display.macd)} />
        <InstRow
          label="POC"
          value={fmtPoc(analysis.poc)}
          tone={analysis.criteria.poc ? 'bull' : analysis.pocRelation === 'below' ? 'bear' : 'neutral'}
        />
      </div>

      <div
        className={cn(
          'mt-1 flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2.5',
          decisionBg,
        )}
      >
        <div className="flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-white/90" aria-hidden />
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/90">Decisão IA</span>
        </div>
        <span className="text-sm font-black uppercase tracking-wider text-white drop-shadow-sm">{decision}</span>
      </div>
    </div>
  )
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.lineTo(x + w - rad, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad)
  ctx.lineTo(x + w, y + h - rad)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  ctx.lineTo(x + rad, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad)
  ctx.lineTo(x, y + rad)
  ctx.quadraticCurveTo(x, y, x + rad, y)
  ctx.closePath()
}

function drawSignalBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  anchorY: number,
  isBuy: boolean,
) {
  const color = isBuy ? '#16a34a' : '#dc2626'
  const label = isBuy ? 'BUY' : 'SELL'
  const badgeOffset = isBuy ? 42 : -42
  const badgeCenterY = anchorY + badgeOffset
  const ph = 18
  const badgeTop = badgeCenterY - ph / 2

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.25
  ctx.beginPath()
  ctx.moveTo(x, anchorY)
  ctx.lineTo(x, isBuy ? badgeTop : badgeTop + ph)
  ctx.stroke()

  ctx.font = 'bold 10px Inter, system-ui, sans-serif'
  const tw = ctx.measureText(label).width
  const pw = tw + 14
  const px = x - pw / 2

  roundRect(ctx, px, badgeTop, pw, ph, 3)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x, badgeCenterY)
  ctx.restore()
}

function drawEmaRibbon(
  ctx: CanvasRenderingContext2D,
  api: MainChartApi,
  bars: OhlcvBar[],
) {
  if (bars.length < 55) return

  const closes = bars.map((b) => b.close)
  const ema20S = ema(closes, 20)
  const ema50S = ema(closes, 50)
  const ts = api.chart.timeScale()
  const series = api.series

  const top: { x: number; y: number }[] = []
  const bot: { x: number; y: number }[] = []

  for (let i = 0; i < bars.length; i++) {
    const e20 = ema20S[i]
    const e50 = ema50S[i]
    if (e20 == null || e50 == null) continue

    const x = ts.timeToCoordinate(bars[i].time as never)
    const y20 = series.priceToCoordinate(e20)
    const y50 = series.priceToCoordinate(e50)
    if (x == null || y20 == null || y50 == null) continue

    if (e20 >= e50) {
      top.push({ x, y: y20 })
      bot.push({ x, y: y50 })
    } else {
      top.push({ x, y: y50 })
      bot.push({ x, y: y20 })
    }
  }

  if (top.length < 2) return

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(top[0].x, top[0].y)
  for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y)
  for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y)
  ctx.closePath()
  ctx.fillStyle = 'rgba(180, 83, 9, 0.22)'
  ctx.fill()

  const strokeLine = (pts: { x: number; y: number }[], color: string, width: number) => {
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.stroke()
  }

  const line20: { x: number; y: number }[] = []
  const line50: { x: number; y: number }[] = []
  for (let i = 0; i < bars.length; i++) {
    const e20 = ema20S[i]
    const e50 = ema50S[i]
    if (e20 == null || e50 == null) continue
    const x = ts.timeToCoordinate(bars[i].time as never)
    const y20 = series.priceToCoordinate(e20)
    const y50 = series.priceToCoordinate(e50)
    if (x == null || y20 == null || y50 == null) continue
    line20.push({ x, y: y20 })
    line50.push({ x, y: y50 })
  }

  strokeLine(line20, 'rgba(59, 130, 246, 0.85)', 1.25)
  strokeLine(line50, 'rgba(245, 158, 11, 0.9)', 1.25)
  ctx.restore()
}

export function TrendRadarMarkers({ analysis, settings, bars = [] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { mainChart } = useChartDrawings()

  const barByTime = useMemo(() => new Map(bars.map((b) => [b.time, b])), [bars])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const api = mainChart
    if (!canvas || !api || !analysis || !settings.enabled) return

    const rect = api.container.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const ts = api.chart.timeScale()
    const series = api.series

    if (bars.length >= 55) {
      drawEmaRibbon(ctx, api, bars)
    }

    if (settings.showPocLine && analysis.poc != null) {
      const yPoc = series.priceToCoordinate(analysis.poc)
      if (yPoc != null) {
        ctx.save()
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)'
        ctx.setLineDash([])
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(0, yPoc)
        ctx.lineTo(w, yPoc)
        ctx.stroke()
        ctx.fillStyle = 'rgba(250, 204, 21, 0.95)'
        ctx.font = 'bold 10px Inter, system-ui, sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`POC ${fmtPoc(analysis.poc)}`, 6, yPoc - 3)
        ctx.restore()
      }
    }

    if (!settings.showMarkers) return

    for (const mk of analysis.markers) {
      const x = ts.timeToCoordinate(mk.time as never)
      if (x == null) continue

      const bar = barByTime.get(mk.time as number)
      const isBuy = mk.type === 'buy'
      const price = isBuy ? (bar?.low ?? mk.price) : (bar?.high ?? mk.price)
      const anchorY = series.priceToCoordinate(price)
      if (anchorY == null) continue

      drawSignalBadge(ctx, x, anchorY, isBuy)
    }
  }, [mainChart, analysis, settings, bars, barByTime])

  useEffect(() => {
    paint()
    const api = mainChart
    if (!api) return
    const ts = api.chart.timeScale()
    const handler = () => paint()
    ts.subscribeVisibleTimeRangeChange(handler)
    const ro = new ResizeObserver(handler)
    ro.observe(api.container)
    return () => {
      ts.unsubscribeVisibleTimeRangeChange(handler)
      ro.disconnect()
    }
  }, [paint, mainChart])

  if (!settings.enabled || !analysis) return null

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[15]"
      aria-hidden
    />
  )
}

export function TrendRadarOverlay({ analysis, settings, bars = [], barsCount = 0 }: Props) {
  if (!settings.enabled) return null

  if (!analysis) {
    return (
      <div className="pointer-events-none absolute right-2 top-12 z-20 rounded-lg border border-white/15 bg-black/88 px-3 py-2 text-[11px] text-zinc-300 shadow-lg sm:right-3 sm:top-14">
        <span className="flex items-center gap-2">
          <Radar className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
          Radar ativo — {barsCount < 55 ? 'a carregar velas…' : 'a analisar mercado…'}
        </span>
      </div>
    )
  }

  return (
    <>
      <TrendRadarMarkers analysis={analysis} settings={settings} bars={bars} />
      <TrendRadarPanel analysis={analysis} settings={settings} />
    </>
  )
}
