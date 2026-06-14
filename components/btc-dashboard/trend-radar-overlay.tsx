'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { useChartDrawings } from '@/components/btc-dashboard/chart-drawings-context'
import type { MainChartApi } from '@/lib/btc/chart-drawing-types'
import { ema } from '@/lib/btc/indicators'
import type { TrendRadarAnalysis } from '@/lib/btc/trend-radar'
import type { OhlcvBar, TrendRadarSettings } from '@/lib/btc/types'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, ChevronUp, Radar, TrendingDown, TrendingUp, X } from 'lucide-react'

type Props = {
  analysis: TrendRadarAnalysis | null
  settings: TrendRadarSettings
  bars?: OhlcvBar[]
  barsCount?: number
  computing?: boolean
}

function fmtPrice(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v >= 1000
    ? v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
    : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function signalLabel(analysis: TrendRadarAnalysis): string {
  if (analysis.signal === 'buy') return 'BUY'
  if (analysis.signal === 'sell') return 'SELL'
  return 'AGUARDAR'
}

function signalTone(analysis: TrendRadarAnalysis): 'buy' | 'sell' | 'wait' {
  if (analysis.signal === 'buy') return 'buy'
  if (analysis.signal === 'sell') return 'sell'
  return 'wait'
}

function IndicatorRow({
  label,
  value,
  ok,
}: {
  label: string
  value: string
  ok: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 border-b border-white/[0.06] py-[3px] last:border-0">
      <span
        className={cn(
          'flex h-3 w-3 shrink-0 items-center justify-center rounded-full',
          ok ? 'bg-emerald-500/25 text-emerald-400' : 'bg-red-500/20 text-red-400',
        )}
        aria-hidden
      >
        {ok ? <Check className="h-2 w-2" strokeWidth={3} /> : <X className="h-2 w-2" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-[8px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <span
        className={cn(
          'shrink-0 font-mono text-[9px] font-semibold tabular-nums',
          ok ? 'text-emerald-300' : 'text-red-300',
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function TrendRadarPanel({ analysis, settings }: Props) {
  const [expanded, setExpanded] = useState(false)
  const isPhone = useIsMobile()

  if (!settings.enabled || !settings.showPanel || !analysis) return null

  const tone = signalTone(analysis)
  const label = signalLabel(analysis)
  const { backtest, checklist } = analysis

  const compactBg =
    tone === 'buy'
      ? 'border-emerald-500/35 bg-emerald-950/90'
      : tone === 'sell'
        ? 'border-red-500/35 bg-red-950/90'
        : 'border-zinc-600/35 bg-zinc-900/92'

  const signalColor =
    tone === 'buy' ? 'text-emerald-300' : tone === 'sell' ? 'text-red-300' : 'text-zinc-400'

  const trendLabel =
    analysis.emaTrend === 'alta' ? 'ALTA' : analysis.emaTrend === 'baixa' ? 'BAIXA' : 'LATERAL'

  return (
    <div
      className={cn(
        'absolute z-20 overflow-hidden rounded-lg border shadow-[0_8px_32px_rgba(0,0,0,0.65)] backdrop-blur-md',
        isPhone
          ? 'bottom-2 right-1.5 max-w-[calc(100%-1rem)]'
          : 'bottom-14 right-2 sm:bottom-16 sm:right-3',
        expanded ? (isPhone ? 'w-[11.5rem]' : 'w-[13.5rem]') : isPhone ? 'w-[8.25rem]' : 'w-[9.5rem]',
        compactBg,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 text-left transition-colors hover:bg-white/[0.04]',
          isPhone ? 'px-2 py-2.5' : 'px-2.5 py-2',
        )}
        aria-expanded={expanded}
        aria-label={expanded ? 'Recolher painel de sinais' : 'Expandir painel de sinais'}
      >
        {tone === 'buy' ? (
          <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
        ) : tone === 'sell' ? (
          <TrendingDown className="h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
        ) : (
          <Radar className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-black uppercase leading-none tracking-wider', signalColor)}>
            {label}
          </p>
          <p className="mt-0.5 text-[9px] text-zinc-400">
            {analysis.probabilityPct}% prob.
            {label === 'AGUARDAR' && analysis.marketBias !== 'lateral' ? (
              <span className="text-zinc-500"> · viés {analysis.marketBias === 'baixa' ? 'venda' : 'compra'}</span>
            ) : null}
          </p>
        </div>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
        )}
      </button>

      {expanded ? (
        <div className="max-h-[min(52vh,22rem)] space-y-2 overflow-y-auto border-t border-white/10 px-2.5 py-2 text-[9px]">
          <div
            className={cn(
              'rounded border px-2 py-1 text-center',
              analysis.emaTrend === 'baixa'
                ? 'border-red-500/25 bg-red-950/40'
                : analysis.emaTrend === 'alta'
                  ? 'border-emerald-500/25 bg-emerald-950/35'
                  : 'border-zinc-600/25 bg-zinc-900/40',
            )}
          >
            <p className="text-[8px] uppercase tracking-wider text-zinc-500">Tendência</p>
            <p
              className={cn(
                'text-xs font-black uppercase',
                analysis.emaTrend === 'baixa'
                  ? 'text-red-300'
                  : analysis.emaTrend === 'alta'
                    ? 'text-emerald-300'
                    : 'text-zinc-400',
              )}
            >
              {trendLabel}
            </p>
            <p className="text-[7px] text-zinc-500">EMA9 {analysis.emaTrend === 'alta' ? '>' : '≤'} EMA21</p>
          </div>

          <div>
            <p className="mb-1 text-[8px] font-bold uppercase tracking-wider text-zinc-500">
              Indicadores · {checklist.confirmed}/{checklist.total}
            </p>
            {checklist.items.map((item) => (
              <IndicatorRow key={item.id} label={item.label} value={item.value} ok={item.ok} />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <div>
              <span className="text-zinc-500">Força</span>
              <p className="font-mono font-bold text-violet-300">{Math.round(analysis.trendForcePct)}%</p>
            </div>
            <div className="text-right">
              <span className="text-zinc-500">Confluência</span>
              <p className="font-mono font-bold text-amber-300">
                {checklist.confirmed}/{checklist.total}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">TP</span>
              <p className="font-mono font-semibold text-emerald-400">{fmtPrice(analysis.takeProfit)}</p>
            </div>
            <div className="text-right">
              <span className="text-zinc-500">SL</span>
              <p className="font-mono font-semibold text-red-400">{fmtPrice(analysis.stopLoss)}</p>
            </div>
          </div>

          <div className="rounded border border-cyan-500/20 bg-cyan-950/30 px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-cyan-400/90">Taxa de acerto</span>
              <span
                className={cn(
                  'font-mono text-xs font-black',
                  backtest.winRatePct >= 68
                    ? 'text-emerald-400'
                    : backtest.winRatePct >= 50
                      ? 'text-amber-400'
                      : 'text-red-400',
                )}
              >
                {backtest.winRatePct}%
              </span>
            </div>
            <p className="mt-0.5 text-[8px] text-zinc-500">
              {backtest.total > 0
                ? `${backtest.wins}W / ${backtest.losses}L · ${backtest.total} ops · líq. de taxas`
                : 'Sem operações válidas'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 text-[8px]">
            <div>
              <span className="text-zinc-500">Lucro acum.</span>
              <p
                className={cn(
                  'font-mono font-bold',
                  backtest.cumulativeProfitPct >= 0 ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {backtest.cumulativeProfitPct >= 0 ? '+' : ''}
                {backtest.cumulativeProfitPct}%
              </p>
            </div>
            <div className="text-right">
              <span className="text-zinc-500">Drawdown máx.</span>
              <p className="font-mono font-bold text-red-300">{backtest.maxDrawdownPct}%</p>
            </div>
          </div>

          <p className="text-center text-[7px] leading-snug text-zinc-600">
            {analysis.backtest.total < 10
              ? 'Amostra pequena — número pouco fiável; não é garantia futura'
              : 'Acerto histórico líq. de taxas · não é garantia futura'}
          </p>
        </div>
      ) : null}
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
  const color = isBuy ? '#22c55e' : '#ef4444'
  const label = isBuy ? 'BUY' : 'SELL'
  const badgeOffset = isBuy ? 40 : -40
  const badgeCenterY = anchorY + badgeOffset
  const ph = 18
  const badgeTop = badgeCenterY - ph / 2

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.2
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

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x, badgeCenterY)
  ctx.restore()
}

function drawIndicatorLines(
  ctx: CanvasRenderingContext2D,
  api: MainChartApi,
  bars: OhlcvBar[],
) {
  if (bars.length < 30) return

  const closes = bars.map((b) => b.close)
  const ema20S = ema(closes, 20)
  const ema50S = ema(closes, 50)
  const ema200S = ema(closes, 200)
  const ts = api.chart.timeScale()
  const series = api.series

  const strokeLine = (values: (number | null)[], color: string, width: number) => {
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i < bars.length; i++) {
      const v = values[i]
      if (v == null) continue
      const x = ts.timeToCoordinate(bars[i].time as never)
      const y = series.priceToCoordinate(v)
      if (x == null || y == null) continue
      pts.push({ x, y })
    }
    if (pts.length < 2) return
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.stroke()
  }

  strokeLine(ema200S, 'rgba(250, 204, 21, 0.55)', 2)
  strokeLine(ema20S, 'rgba(34, 197, 94, 0.35)', 1)
  strokeLine(ema50S, 'rgba(96, 165, 250, 0.35)', 1)
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

    if (settings.showChartLines && bars.length >= 30) {
      drawIndicatorLines(ctx, api, bars)
    }

    if (settings.showPocLine && analysis.poc != null) {
      const yPoc = series.priceToCoordinate(analysis.poc)
      if (yPoc != null) {
        ctx.save()
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(0, yPoc)
        ctx.lineTo(w, yPoc)
        ctx.stroke()
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
    ts.subscribeVisibleLogicalRangeChange(handler)
    const ro = new ResizeObserver(handler)
    ro.observe(api.container)
    return () => {
      ts.unsubscribeVisibleLogicalRangeChange(handler)
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

export function TrendRadarOverlay({ analysis, settings, bars = [], barsCount = 0, computing = false }: Props) {
  if (!settings.enabled) return null

  if (!analysis) {
    return (
      <div className="pointer-events-none absolute bottom-14 right-2 z-20 rounded-lg border border-white/15 bg-black/88 px-3 py-2 text-[11px] text-zinc-300 shadow-lg sm:bottom-16 sm:right-3">
        <span className="flex items-center gap-2">
          <Radar className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
          {barsCount < 55 ? 'A carregar…' : computing ? 'A calcular sinais…' : 'A otimizar sinais…'}
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
