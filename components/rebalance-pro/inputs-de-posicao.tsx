'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export type InputsDePosicaoProps = {
  pairLabel: string
  priceSymbol: string
  autoPrice: boolean
  onAutoPriceChange: (v: boolean) => void
  manualPrice: string
  onManualPriceChange: (v: string) => void
  livePrice: number | null
  priceLoading: boolean
  priceError: string | null
  pMin: string
  pMax: string
  capital: string
  onPMin: (v: string) => void
  onPMax: (v: string) => void
  onCapital: (v: string) => void
  invalidRange: boolean
  className?: string
}

/** Bloqueia valores negativos e sinal "-" nos campos de preço. */
export function sanitizeNonNegativeDecimalInput(next: string, previous: string): string {
  const t = next.replace(',', '.')
  if (t === '' || t === '.') return next
  if (/^-/.test(t.trim())) return previous
  const n = parseFloat(t)
  if (Number.isFinite(n) && n < 0) return previous
  return next
}

export function InputsDePosicao({
  pairLabel,
  priceSymbol,
  autoPrice,
  onAutoPriceChange,
  manualPrice,
  onManualPriceChange,
  livePrice,
  priceLoading,
  priceError,
  pMin,
  pMax,
  capital,
  onPMin,
  onPMax,
  onCapital,
  invalidRange,
  className,
}: InputsDePosicaoProps) {
  const displayPrice =
    autoPrice && livePrice != null && Number.isFinite(livePrice) && livePrice >= 0
      ? livePrice
      : Math.max(0, parseFloat(manualPrice.replace(',', '.')) || 0)

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className={cn(
        'rounded-3xl border border-white/[0.07] bg-zinc-950/70 p-5 shadow-xl shadow-black/40 backdrop-blur-xl sm:p-6',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-bold text-cyan-200">
          2
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">Sua posição</h2>
          <p className="font-mono text-xs text-violet-200/90">{pairLabel}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Preço atual ({priceSymbol} · USD)
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">Atualizado pela CoinGecko no modo automático.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <span className="text-xs text-muted-foreground">Automático</span>
            <Switch checked={autoPrice} onCheckedChange={onAutoPriceChange} aria-label="Preço automático" />
            <span className="text-xs font-medium text-foreground">Manual</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div
            className={cn(
              'rounded-2xl border border-white/10 bg-white/[0.03] p-4',
              autoPrice && 'ring-1 ring-cyan-500/20',
            )}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Cotação</p>
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
              {autoPrice ? (
                priceLoading ? (
                  <span className="text-muted-foreground">…</span>
                ) : livePrice != null && livePrice >= 0 ? (
                  `$${livePrice.toLocaleString('pt-BR', { maximumFractionDigits: livePrice < 1 ? 6 : 2 })}`
                ) : (
                  <span className="text-amber-400/90">—</span>
                )
              ) : (
                `$${displayPrice.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}`
              )}
            </p>
            {priceError && autoPrice && <p className="mt-2 text-xs text-amber-500/90">{priceError}</p>}
          </div>

          {!autoPrice && (
            <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] p-4">
              <Label htmlFor="manual-p" className="text-[10px] uppercase tracking-wider text-violet-200/85">
                Preço manual (USD)
              </Label>
              <input
                id="manual-p"
                type="text"
                inputMode="decimal"
                value={manualPrice}
                onChange={(e) => onManualPriceChange(sanitizeNonNegativeDecimalInput(e.target.value, manualPrice))}
                placeholder="0,00"
                className="mt-2 w-full border-b border-white/20 bg-transparent py-1 font-mono text-2xl font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:border-cyan-400/50"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Intervalo</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Mínimo e máximo em USD por {priceSymbol} (mesmo eixo do preço acima). Valores negativos não são permitidos.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="pmin2" className="text-xs uppercase tracking-wider text-muted-foreground">
              Preço mínimo (P<sub>min</sub>)
            </Label>
            <input
              id="pmin2"
              type="text"
              inputMode="decimal"
              value={pMin}
              onChange={(e) => onPMin(sanitizeNonNegativeDecimalInput(e.target.value, pMin))}
              className={cn(
                'h-12 w-full rounded-xl border bg-white/[0.04] px-3 font-mono text-sm outline-none transition focus:ring-2 focus:ring-violet-500/35',
                invalidRange ? 'border-red-500/45' : 'border-white/10',
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pmax2" className="text-xs uppercase tracking-wider text-muted-foreground">
              Preço máximo (P<sub>max</sub>)
            </Label>
            <input
              id="pmax2"
              type="text"
              inputMode="decimal"
              value={pMax}
              onChange={(e) => onPMax(sanitizeNonNegativeDecimalInput(e.target.value, pMax))}
              className={cn(
                'h-12 w-full rounded-xl border bg-white/[0.04] px-3 font-mono text-sm outline-none transition focus:ring-2 focus:ring-cyan-500/35',
                invalidRange ? 'border-red-500/45' : 'border-white/10',
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cap2" className="text-xs uppercase tracking-wider text-muted-foreground">
              Capital (opcional, USD)
            </Label>
            <input
              id="cap2"
              type="text"
              inputMode="decimal"
              value={capital}
              onChange={(e) => onCapital(sanitizeNonNegativeDecimalInput(e.target.value, capital))}
              placeholder="ex.: 10 000"
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500/25"
            />
          </div>
        </div>
        {invalidRange && (
          <p className="mt-3 text-sm font-medium text-red-400/95">
            O preço mínimo precisa ser menor que o máximo.
          </p>
        )}
      </div>
    </motion.section>
  )
}
