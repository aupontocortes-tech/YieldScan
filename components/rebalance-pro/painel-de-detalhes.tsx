'use client'

import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { MarketDataPanel } from '@/components/rebalance-pro/market-data-panel'
import { SliderControl } from '@/components/rebalance-pro/slider-control'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { MarketTrend } from '@/lib/rebalance-pro/decision-engine'

export type PainelDeDetalhesProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  pairLabel: string
  chartTokenSymbol: string
  marketProps: {
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
  }
  smartMode: boolean
  onSmartModeChange: (v: boolean) => void
  aggressiveness: number
  onAggressivenessChange: (v: number) => void
  newMin: number | null
  newMax: number | null
  rangeShiftPct: number | null
  impermanentLossHintPct: number | null
  showRangeSuggestion: boolean
  className?: string
}

function fmtUsd(v: number) {
  if (!Number.isFinite(v) || v < 0) return '—'
  return `$${v.toLocaleString('pt-BR', { maximumFractionDigits: v >= 1000 ? 2 : 4 })}`
}

export function PainelDeDetalhes({
  open,
  onOpenChange,
  pairLabel,
  chartTokenSymbol,
  marketProps,
  smartMode,
  onSmartModeChange,
  aggressiveness,
  onAggressivenessChange,
  newMin,
  newMax,
  rangeShiftPct,
  impermanentLossHintPct,
  showRangeSuggestion,
  className,
}: PainelDeDetalhesProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className={cn('w-full', className)}>
      <CollapsibleTrigger asChild>
        <motion.button
          type="button"
          layout
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left text-sm font-medium text-foreground backdrop-blur-sm transition hover:bg-white/[0.06]"
        >
          <span>Ver detalhes</span>
          <ChevronDown
            className={cn('size-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        </motion.button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-4">
        <MarketDataPanel
          {...marketProps}
          pairLabel={pairLabel}
          chartTokenSymbol={chartTokenSymbol}
          className="border-white/[0.06]"
        />

        {showRangeSuggestion && (
          <div className="rounded-2xl border border-white/[0.07] bg-zinc-950/60 p-5 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Ajuste da faixa sugerida</h3>
                <p className="text-xs text-muted-foreground">Opcional — afina o intervalo recentrado.</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <span className="text-xs text-muted-foreground">Modo inteligente</span>
                <Switch checked={smartMode} onCheckedChange={onSmartModeChange} />
              </div>
            </div>
            <SliderControl
              className="mt-4 border-white/10"
              label="Agressividade"
              hint="Largura sugerida em relação ao seu intervalo atual."
              min={0.5}
              max={1.5}
              step={0.01}
              value={aggressiveness}
              onChange={onAggressivenessChange}
            />

            {newMin != null && newMax != null && (
              <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Novo mín. sugerido</Label>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">
                    {fmtUsd(newMin)}
                  </p>
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Novo máx. sugerido</Label>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">
                    {fmtUsd(newMax)}
                  </p>
                </div>
                {rangeShiftPct != null && Number.isFinite(rangeShiftPct) && (
                  <p className="col-span-full text-sm text-cyan-300/90">
                    Deslocamento do centro: {rangeShiftPct >= 0 ? '+' : ''}
                    {rangeShiftPct.toFixed(1)}%
                  </p>
                )}
                {impermanentLossHintPct != null && Number.isFinite(impermanentLossHintPct) && (
                  <p className="col-span-full text-xs text-amber-200/85">
                    Estimativa de IL (indicativa): ~{impermanentLossHintPct.toFixed(1)}%
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
