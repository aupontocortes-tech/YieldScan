'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingDown, TrendingUp, Minus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { trendLabelPt, type MarketTrend } from '@/lib/rebalance-pro/decision-engine'

type MarketDataPanelProps = {
  price: number | null
  change24hPct: number | null
  volatilityPct: number
  trend: MarketTrend
  windowReturnPct: number
  chartDays: 1 | 7
  onChartDaysChange: (d: 1 | 7) => void
  prices: [number, number][]
  priceLoading: boolean
  chartLoading: boolean
  refreshing: boolean
  error: string | null
  onRefresh: () => void
  /** Ex.: ETH / USDC */
  pairLabel?: string
  /** Símbolo do ativo usado no gráfico/preço USD */
  chartTokenSymbol?: string
  className?: string
}

function Sparkline({ prices }: { prices: [number, number][] }) {
  const path = React.useMemo(() => {
    if (prices.length < 2) return ''
    const ys = prices.map((p) => p[1])
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const span = maxY - minY || 1
    const w = 100
    const h = 36
    return prices
      .map((p, i) => {
        const x = (i / (prices.length - 1)) * w
        const y = h - ((p[1] - minY) / span) * h
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(' ')
  }, [prices])

  if (prices.length < 2) {
    return null
  }

  return (
    <svg viewBox="0 0 100 36" className="h-10 w-full overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="rgb(34, 211, 238)" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill="none"
        stroke="url(#spark)"
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrendIcon({ trend }: { trend: MarketTrend }) {
  if (trend === 'uptrend') return <TrendingUp className="size-4 text-emerald-400" aria-hidden />
  if (trend === 'downtrend') return <TrendingDown className="size-4 text-red-400" aria-hidden />
  return <Minus className="size-4 text-muted-foreground" aria-hidden />
}

export function MarketDataPanel({
  price,
  change24hPct,
  volatilityPct,
  trend,
  windowReturnPct,
  chartDays,
  onChartDaysChange,
  prices,
  priceLoading,
  chartLoading,
  refreshing,
  error,
  onRefresh,
  pairLabel,
  chartTokenSymbol,
  className,
}: MarketDataPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border border-white/[0.08] bg-zinc-950/50 p-5 shadow-lg shadow-black/30 backdrop-blur-xl sm:p-6',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10">
            <BarChart3 className="size-4 text-violet-300" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Mercado</h2>
            {pairLabel && (
              <p className="font-mono text-[11px] font-medium text-violet-200/85">Pool {pairLabel}</p>
            )}
            <p className="text-[11px] text-muted-foreground/90">
              CoinGecko · {chartTokenSymbol ? `${chartTokenSymbol} em USD` : 'preço atual'} e histórico recente
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/10 p-0.5">
            {([1, 7] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChartDaysChange(d)}
                disabled={chartLoading}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-40',
                  chartDays === d
                    ? 'bg-white/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 border-white/10 bg-white/5"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Atualizar dados de mercado"
          >
            <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Preço atual</p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
            {priceLoading && price == null ? (
              <span className="text-muted-foreground">…</span>
            ) : price != null ? (
              `$${price.toLocaleString('pt-BR', { maximumFractionDigits: price < 1 ? 6 : 2 })}`
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </p>
          {change24hPct != null && Number.isFinite(change24hPct) && (
            <p
              className={cn(
                'mt-1 font-mono text-sm font-medium tabular-nums',
                change24hPct >= 0 ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              24h: {change24hPct >= 0 ? '+' : ''}
              {change24hPct.toFixed(2)}%
            </p>
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Volatilidade (24h)</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-cyan-300/95">
            {priceLoading && change24hPct == null ? (
              <span className="text-muted-foreground">…</span>
            ) : (
              `${volatilityPct.toFixed(2)}%`
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {chartLoading && prices.length < 2 ? (
              <span className="text-muted-foreground">Carregando tendência…</span>
            ) : (
              <>
                <TrendIcon trend={trend} />
                <span>{trendLabelPt(trend)}</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="font-mono tabular-nums">
                  {windowReturnPct >= 0 ? '+' : ''}
                  {windowReturnPct.toFixed(2)}% em {chartDays}d
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Gráfico do preço</p>
        <div className="mt-2">
          {chartLoading && prices.length < 2 ? (
            <div className="flex h-10 items-center text-[11px] text-muted-foreground">Carregando gráfico…</div>
          ) : (
            <Sparkline prices={prices} />
          )}
          {!chartLoading && prices.length < 2 && (
            <div className="h-9 text-[10px] text-muted-foreground">Sem dados de gráfico (tenta atualizar)</div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
