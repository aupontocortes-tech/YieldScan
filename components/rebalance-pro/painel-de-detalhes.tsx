'use client'

import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { MarketDataPanel } from '@/components/rebalance-pro/market-data-panel'
import { SliderControl } from '@/components/rebalance-pro/slider-control'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { MarketTrend } from '@/lib/rebalance-pro/decision-engine'
import type { RangeMode } from '@/lib/rebalance-pro/compute'

export type PainelDeDetalhesProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  pairLabel: string
  chartTokenSymbol: string
  priceSymbol: string
  quoteSymbol: string
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
  rangeMode: RangeMode
  onRangeModeChange: (m: RangeMode) => void
  percentualFrac: number
  onPercentualFracChange: (v: number) => void
  newMin: number | null
  newMax: number | null
  rangeUsado: number | null
  tokenAQty: number | null
  tokenBUsd: number | null
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
  priceSymbol,
  quoteSymbol,
  marketProps,
  rangeMode,
  onRangeModeChange,
  percentualFrac,
  onPercentualFracChange,
  newMin,
  newMax,
  rangeUsado,
  tokenAQty,
  tokenBUsd,
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
                <h3 className="text-sm font-semibold text-foreground">Novo range (centrado no preço atual)</h3>
                <p className="text-xs text-muted-foreground">
                  Simples = mesma largura que P<sub>max</sub> − P<sub>min</sub>. Dinâmico = % do preço.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  { id: 'simples' as const, label: 'Fixo (faixa antiga)' },
                  { id: 'dinamico' as const, label: 'Dinâmico (% do preço)' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onRangeModeChange(id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                    rangeMode === id
                      ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100'
                      : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {rangeMode === 'dinamico' && (
              <SliderControl
                className="mt-4 border-white/10"
                label="Percentual do preço"
                hint={`Largura total ≈ ${(percentualFrac * 100).toFixed(1)}% do preço (± metade em cada lado).`}
                min={0.02}
                max={0.5}
                step={0.01}
                value={percentualFrac}
                onChange={onPercentualFracChange}
                format={(v) => `${(v * 100).toFixed(0)}%`}
                footerLeft="2% do preço"
                footerRight="50% do preço"
              />
            )}

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
                {rangeUsado != null && Number.isFinite(rangeUsado) && (
                  <div className="col-span-full">
                    <Label className="text-[10px] uppercase text-muted-foreground">Largura usada (range)</Label>
                    <p className="mt-1 font-mono text-sm tabular-nums text-violet-200/90">
                      {fmtUsd(rangeUsado)} USD no eixo do {priceSymbol}
                    </p>
                  </div>
                )}
                {tokenAQty != null && tokenBUsd != null && Number.isFinite(tokenAQty) && Number.isFinite(tokenBUsd) && (
                  <div className="col-span-full rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-200/90">
                      Montagem 50/50 (valor)
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Metade do capital em cada lado: {priceSymbol} ≈ qty abaixo; {quoteSymbol} ≈ USD na cotação.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">{priceSymbol} (qty)</Label>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
                          {tokenAQty.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}
                        </p>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">{quoteSymbol} (≈ USD)</Label>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
                          {fmtUsd(tokenBUsd)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
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
