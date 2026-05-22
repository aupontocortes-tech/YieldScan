'use client'

import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import { Switch } from '@/components/ui/switch'
import {
  CYCLE_BOTTOM_INDICATORS,
  getCycleBottomTimeframe,
  type CycleBottomIndicatorId,
} from '@/lib/btc/cycle-bottom-config'
import { cn } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'

type CycleBottomPanelProps = {
  variant?: 'settings' | 'inline'
  /** Fecha o painel lateral para ver o gráfico no intervalo correcto. */
  onChartViewApplied?: () => void
}

/**
 * Três indicadores de fundo de ciclo (Pompx) — toggles gravados em SQLite/localStorage.
 * Ao ligar (ou clicar de novo), o gráfico muda para Diário / Semanal / Mensal.
 */
export function CycleBottomPanel({ variant = 'settings', onChartViewApplied }: CycleBottomPanelProps) {
  const {
    timeframe,
    setTimeframe,
    sma200Daily,
    setSma200Daily,
    bullMarketBand,
    setBullMarketBand,
    cycleBottomAlerts,
    setCycleBottomAlerts,
  } = useBtcSettings()

  const stateById: Record<
    CycleBottomIndicatorId,
    { checked: boolean; setEnabled: (v: boolean) => void }
  > = {
    sma200: {
      checked: sma200Daily.enabled,
      setEnabled: (v) => setSma200Daily({ ...sma200Daily, enabled: v }),
    },
    bmsb: {
      checked: bullMarketBand.enabled,
      setEnabled: (v) => setBullMarketBand({ ...bullMarketBand, enabled: v }),
    },
    alerts: {
      checked: cycleBottomAlerts.enabled,
      setEnabled: (v) => setCycleBottomAlerts({ ...cycleBottomAlerts, enabled: v }),
    },
  }

  const applyChartFor = (id: CycleBottomIndicatorId) => {
    const tf = getCycleBottomTimeframe(id)
    if (tf && tf.id !== timeframe.id) setTimeframe(tf)
    onChartViewApplied?.()
  }

  const handleToggle = (id: CycleBottomIndicatorId, next: boolean) => {
    if (next) applyChartFor(id)
    stateById[id].setEnabled(next)
  }

  const handleCardActivate = (id: CycleBottomIndicatorId) => {
    applyChartFor(id)
    if (!stateById[id].checked) stateById[id].setEnabled(true)
  }

  const isSettings = variant === 'settings'

  return (
    <section
      className={cn(
        'rounded-xl border p-4',
        isSettings
          ? 'border-[#d4af37]/25 bg-[#0d0d0d]'
          : 'border-[#d4af37]/30 bg-gradient-to-br from-[#d4af37]/8 via-[#0a0a0a] to-[#050505] p-3',
      )}
      aria-label="Indicadores de fundo de ciclo"
    >
      <div className="mb-3 flex items-start gap-2">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[#d4af37]" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Fundos de ciclo · Bull market (Pompx)</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
            Cada indicador usa o seu intervalo: <span className="text-zinc-400">diário</span>,{' '}
            <span className="text-zinc-400">semanal</span> ou <span className="text-zinc-400">mensal</span>. Ao ligar,
            o gráfico muda automaticamente para esse tempo — é aí que vês o rompimento e o início do bull market.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {CYCLE_BOTTOM_INDICATORS.map((meta) => {
          const { checked, setEnabled } = stateById[meta.id]
          const chartActive = timeframe.id === meta.timeframeId

          return (
            <div
              key={meta.id}
              role="button"
              tabIndex={0}
              onClick={() => handleCardActivate(meta.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleCardActivate(meta.id)
                }
              }}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/50',
                checked
                  ? 'border-[#d4af37]/45 bg-[#d4af37]/10'
                  : 'border-white/[0.08] bg-black/40 hover:border-white/15',
                chartActive && checked && 'ring-1 ring-[#d4af37]/35',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[11px] font-medium text-zinc-100">{meta.label}</p>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide',
                        chartActive ? 'bg-[#d4af37] text-black' : 'bg-zinc-800 text-zinc-400',
                      )}
                    >
                      {meta.timeframeLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">{meta.hint}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">{meta.bullMarketHint}</p>
                  {chartActive && (
                    <p className="mt-1 text-[9px] font-medium text-[#d4af37]/90">Gráfico neste intervalo</p>
                  )}
                </div>
                <Switch
                  checked={checked}
                  onCheckedChange={(v) => handleToggle(meta.id, v)}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0"
                  aria-label={`${meta.label} — ${meta.timeframeLabel}`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
