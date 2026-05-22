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
  /** Sem cabeçalho duplicado (dentro de acordeão no painel). */
  compact?: boolean
  /** Fecha o painel lateral para ver o gráfico no intervalo correcto. */
  onChartViewApplied?: () => void
  /** Abre o gráfico em ecrã inteiro (Golden / Death Cross). */
  onFullscreenFocus?: () => void
}

/**
 * Indicadores de fundo de ciclo (Pompx) — toggles gravados em SQLite/localStorage.
 */
export function CycleBottomPanel({
  variant = 'settings',
  compact = false,
  onChartViewApplied,
  onFullscreenFocus,
}: CycleBottomPanelProps) {
  const {
    timeframe,
    setTimeframe,
    sma200Daily,
    setSma200Daily,
    bullMarketBand,
    setBullMarketBand,
    sma50Weekly,
    setSma50Weekly,
    goldenCrossDaily,
    setGoldenCrossDaily,
  } = useBtcSettings()

  const stateById: Record<
    CycleBottomIndicatorId,
    { checked: boolean; setEnabled: (v: boolean) => void }
  > = {
    goldenCross: {
      checked: goldenCrossDaily.enabled,
      setEnabled: (v) => setGoldenCrossDaily({ ...goldenCrossDaily, enabled: v }),
    },
    sma200: {
      checked: sma200Daily.enabled,
      setEnabled: (v) => setSma200Daily({ ...sma200Daily, enabled: v }),
    },
    bmsb: {
      checked: bullMarketBand.enabled,
      setEnabled: (v) => setBullMarketBand({ ...bullMarketBand, enabled: v }),
    },
    sma50w: {
      checked: sma50Weekly.enabled,
      setEnabled: (v) => setSma50Weekly({ ...sma50Weekly, enabled: v }),
    },
  }

  const applyChartFor = (id: CycleBottomIndicatorId) => {
    const tf = getCycleBottomTimeframe(id)
    if (tf && tf.id !== timeframe.id) setTimeframe(tf)
    onChartViewApplied?.()
  }

  const handleToggle = (id: CycleBottomIndicatorId, next: boolean) => {
    if (next) {
      applyChartFor(id)
      const meta = CYCLE_BOTTOM_INDICATORS.find((m) => m.id === id)
      if (meta?.fullscreenOnActivate) onFullscreenFocus?.()
    }
    stateById[id].setEnabled(next)
  }

  const handleCardActivate = (id: CycleBottomIndicatorId) => {
    const meta = CYCLE_BOTTOM_INDICATORS.find((m) => m.id === id)
    applyChartFor(id)
    if (!stateById[id].checked) stateById[id].setEnabled(true)
    if (meta?.fullscreenOnActivate) onFullscreenFocus?.()
  }

  const isSettings = variant === 'settings'

  const grid = (
      <div className="grid grid-cols-2 gap-2">
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
                'flex min-h-[7.25rem] flex-col rounded-lg border px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/50 sm:min-h-[7.5rem] sm:px-3 sm:py-2.5',
                checked
                  ? 'border-[#d4af37]/45 bg-[#d4af37]/10'
                  : 'border-white/[0.08] bg-black/40 hover:border-white/15',
                chartActive && checked && 'ring-1 ring-[#d4af37]/35',
              )}
            >
              <div className="flex flex-1 items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[11px] font-medium leading-snug text-zinc-100">{meta.label}</p>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide',
                        chartActive ? 'bg-[#d4af37] text-black' : 'bg-zinc-800 text-zinc-400',
                      )}
                    >
                      {meta.timeframeLabel}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-zinc-500">{meta.hint}</p>
                  <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-zinc-600">{meta.bullMarketHint}</p>
                  {chartActive && checked && (
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
  )

  if (compact) {
    return <div aria-label="Indicadores de fundo de ciclo">{grid}</div>
  }

  return (
    <section
      className={cn(
        'rounded-xl border p-3 sm:p-4',
        isSettings
          ? 'border-[#d4af37]/25 bg-[#0d0d0d]'
          : 'border-[#d4af37]/30 bg-gradient-to-br from-[#d4af37]/8 via-[#0a0a0a] to-[#050505]',
      )}
      aria-label="Indicadores de fundo de ciclo"
    >
      <div className="mb-3 flex items-start gap-2">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[#d4af37]" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Fundos de ciclo · Bull market (Pompx)</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500 sm:text-[11px]">
            Quatro cartões no mesmo formato. O <span className="text-zinc-400">Golden Cross</span> abre em ecrã inteiro
            (SMA 50 + 200 no diário).
          </p>
        </div>
      </div>
      {grid}
    </section>
  )
}
