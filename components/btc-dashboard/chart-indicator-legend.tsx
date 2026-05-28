'use client'

import { useMemo } from 'react'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import { CYCLE_BOTTOM_INDICATORS } from '@/lib/btc/cycle-bottom-config'
import type { GoldenCrossState } from '@/lib/btc/cycle-bottom'
import {
  BULL_MARKET_BAND_EMA_WEEKS,
  BULL_MARKET_BAND_SMA_WEEKS,
} from '@/lib/btc/types'
import { cn } from '@/lib/utils'
import { Settings2, X } from 'lucide-react'

export type ChartLegendSettingsFocus =
  | 'cycle'
  | 'moving-averages'
  | 'on-chain'
  | 'rsi'
  | 'macd'
  | 'stoch'

type LegendRow = {
  id: string
  label: string
  colors: string[]
  status?: string
  statusTone?: 'bull' | 'bear' | 'neutral'
  onRemove: () => void
  settingsFocus: ChartLegendSettingsFocus
}

type ChartIndicatorLegendProps = {
  goldenCrossState?: GoldenCrossState
  onOpenSettings?: (focus: ChartLegendSettingsFocus) => void
  className?: string
  /** strip = barra horizontal acima do gráfico (mobile); overlay = canto do gráfico (desktop). */
  variant?: 'overlay' | 'strip'
}

function statusToneClass(tone?: LegendRow['statusTone']) {
  if (tone === 'bull') return 'text-emerald-400/90'
  if (tone === 'bear') return 'text-red-300/90'
  return 'text-zinc-500'
}

function shortLabel(label: string): string {
  return label
    .replace(' (proxy)', '')
    .replace('Multiple', 'Mult.')
    .replace('Golden / Death Cross', 'G/D Cross')
    .replace('Bull Market Band', 'BMSB')
    .replace('Bollinger Bands', 'BB')
}

function LegendPill({
  row,
  onOpenSettings,
  compact,
}: {
  row: LegendRow
  onOpenSettings?: (focus: ChartLegendSettingsFocus) => void
  compact?: boolean
}) {
  const display = compact ? shortLabel(row.label) : row.label

  return (
    <div
      className={cn(
        'flex max-w-full items-center gap-1.5 rounded-md border border-white/[0.12] bg-black/90 shadow-md backdrop-blur-sm',
        compact ? 'shrink-0 rounded-full py-0.5 pl-1.5 pr-0.5' : 'py-1 pl-1.5 pr-1',
        row.statusTone === 'bear' && 'border-red-500/25',
        row.statusTone === 'bull' && 'border-emerald-500/25',
      )}
    >
      <div className="flex shrink-0 items-center gap-0.5">
        {row.colors.map((c, i) => (
          <span
            key={`${row.id}-${i}`}
            className={cn(
              'rounded-[2px] border border-white/10',
              compact ? 'h-2 w-2' : 'h-2.5 w-2.5',
            )}
            style={{ backgroundColor: c }}
            aria-hidden
          />
        ))}
      </div>
      <div className={cn('min-w-0', compact ? 'max-w-[5.5rem]' : 'flex-1')}>
        <p
          className={cn(
            'truncate font-medium leading-tight text-zinc-100',
            compact ? 'text-[10px]' : 'text-[11px]',
          )}
        >
          {display}
        </p>
        {!compact && row.status ? (
          <p className={cn('truncate text-[9px] leading-snug', statusToneClass(row.statusTone))}>
            {row.status}
          </p>
        ) : null}
      </div>
      {onOpenSettings && !compact ? (
        <button
          type="button"
          className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-[#d4af37]"
          aria-label={`Configurar ${row.label}`}
          onClick={() => onOpenSettings(row.settingsFocus)}
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <button
        type="button"
        className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-red-400"
        aria-label={`Remover ${row.label}`}
        onClick={row.onRemove}
      >
        <X className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      </button>
    </div>
  )
}

function useLegendRows(goldenCrossState?: GoldenCrossState): LegendRow[] {
  const {
    mas,
    removeMa,
    bollinger,
    setBollinger,
    bullMarketBand,
    setBullMarketBand,
    sma200Daily,
    setSma200Daily,
    sma50Weekly,
    setSma50Weekly,
    goldenCrossDaily,
    setGoldenCrossDaily,
    onChain,
    setOnChain,
    rsi,
    setRsi,
    macd,
    setMacd,
    stoch,
    setStoch,
  } = useBtcSettings()

  return useMemo(() => {
    const list: LegendRow[] = []

    if (goldenCrossDaily.enabled) {
      const meta = CYCLE_BOTTOM_INDICATORS.find((m) => m.id === 'goldenCross')
      list.push({
        id: 'goldenCross',
        label: meta?.label ?? 'Golden / Death Cross',
        colors: [goldenCrossDaily.colorSma50, goldenCrossDaily.colorSma200],
        status: goldenCrossState?.message,
        statusTone:
          goldenCrossState?.regime === 'golden'
            ? 'bull'
            : goldenCrossState?.regime === 'death'
              ? 'bear'
              : 'neutral',
        onRemove: () => setGoldenCrossDaily({ ...goldenCrossDaily, enabled: false }),
        settingsFocus: 'cycle',
      })
    } else if (sma200Daily.enabled) {
      const meta = CYCLE_BOTTOM_INDICATORS.find((m) => m.id === 'sma200')
      list.push({
        id: 'sma200',
        label: `SMA 200 (${meta?.timeframeLabel ?? 'Diário'})`,
        colors: [sma200Daily.color],
        onRemove: () => setSma200Daily({ ...sma200Daily, enabled: false }),
        settingsFocus: 'cycle',
      })
    }

    if (sma50Weekly.enabled) {
      const meta = CYCLE_BOTTOM_INDICATORS.find((m) => m.id === 'sma50w')
      list.push({
        id: 'sma50w',
        label: `SMA 50 (${meta?.timeframeLabel ?? 'Semanal'})`,
        colors: [sma50Weekly.color],
        onRemove: () => setSma50Weekly({ ...sma50Weekly, enabled: false }),
        settingsFocus: 'cycle',
      })
    }

    if (bullMarketBand.enabled) {
      const meta = CYCLE_BOTTOM_INDICATORS.find((m) => m.id === 'bmsb')
      list.push({
        id: 'bmsb',
        label: meta?.label ?? 'Bull Market Band',
        colors: [bullMarketBand.colorSma, bullMarketBand.colorEma],
        status: `SMA ${BULL_MARKET_BAND_SMA_WEEKS}w · EMA ${BULL_MARKET_BAND_EMA_WEEKS}w`,
        onRemove: () => setBullMarketBand({ ...bullMarketBand, enabled: false }),
        settingsFocus: 'cycle',
      })
    }

    mas.forEach((ma) => {
      list.push({
        id: `ma-${ma.id}`,
        label: `${ma.type} ${ma.period}`,
        colors: [ma.color],
        onRemove: () => removeMa(ma.id),
        settingsFocus: 'moving-averages',
      })
    })

    if (bollinger.enabled) {
      list.push({
        id: 'bollinger',
        label: `Bollinger Bands (${bollinger.period})`,
        colors: [bollinger.colors.middle],
        onRemove: () => setBollinger({ ...bollinger, enabled: false }),
        settingsFocus: 'cycle',
      })
    }

    const onChainRows: { id: string; label: string; color: string; off: () => void }[] = []
    if (onChain.mayer.enabled) {
      onChainRows.push({
        id: 'mayer',
        label: 'Mayer Multiple (proxy)',
        color: onChain.mayer.color,
        off: () => setOnChain((p) => ({ ...p, mayer: { ...p.mayer, enabled: false } })),
      })
    }
    if (onChain.aviv.enabled) {
      onChainRows.push({
        id: 'aviv',
        label: 'AVIV (proxy)',
        color: onChain.aviv.color,
        off: () => setOnChain((p) => ({ ...p, aviv: { ...p.aviv, enabled: false } })),
      })
    }
    if (onChain.mvrv.enabled) {
      onChainRows.push({
        id: 'mvrv',
        label: 'MVRV (proxy)',
        color: onChain.mvrv.color,
        off: () => setOnChain((p) => ({ ...p, mvrv: { ...p.mvrv, enabled: false } })),
      })
    }
    if (onChain.mvrvZ.enabled) {
      onChainRows.push({
        id: 'mvrvZ',
        label: 'MVRV Z-Score (proxy)',
        color: onChain.mvrvZ.color,
        off: () => setOnChain((p) => ({ ...p, mvrvZ: { ...p.mvrvZ, enabled: false } })),
      })
    }
    if (onChain.sopr.enabled) {
      onChainRows.push({
        id: 'sopr',
        label: 'SOPR (proxy)',
        color: onChain.sopr.color,
        off: () => setOnChain((p) => ({ ...p, sopr: { ...p.sopr, enabled: false } })),
      })
    }
    if (onChain.nupl.enabled) {
      onChainRows.push({
        id: 'nupl',
        label: 'NUPL (proxy)',
        color: onChain.nupl.color,
        off: () => setOnChain((p) => ({ ...p, nupl: { ...p.nupl, enabled: false } })),
      })
    }
    if (onChain.sthLth.enabled) {
      onChainRows.push({
        id: 'sthLth',
        label: 'STH vs LTH (proxy)',
        color: onChain.sthLth.colorLth,
        off: () => setOnChain((p) => ({ ...p, sthLth: { ...p.sthLth, enabled: false } })),
      })
    }
    onChainRows.forEach((o) => {
      list.push({
        id: o.id,
        label: o.label,
        colors: [o.color],
        onRemove: o.off,
        settingsFocus: 'on-chain',
      })
    })

    if (rsi.enabled && rsi.view === 'panel') {
      list.push({
        id: 'rsi',
        label: `RSI (${rsi.period})`,
        colors: [rsi.colors.line],
        onRemove: () => setRsi({ ...rsi, enabled: false }),
        settingsFocus: 'rsi',
      })
    }
    if (macd.enabled && macd.view === 'panel') {
      list.push({
        id: 'macd',
        label: 'MACD',
        colors: [macd.colors.line],
        onRemove: () => setMacd({ ...macd, enabled: false }),
        settingsFocus: 'macd',
      })
    }
    if (stoch.enabled && stoch.view === 'panel') {
      list.push({
        id: 'stoch',
        label: 'Stochastic',
        colors: [stoch.colors.k],
        onRemove: () => setStoch({ ...stoch, enabled: false }),
        settingsFocus: 'stoch',
      })
    }

    return list
  }, [
    goldenCrossState,
    goldenCrossDaily,
    setGoldenCrossDaily,
    sma200Daily,
    setSma200Daily,
    sma50Weekly,
    setSma50Weekly,
    bullMarketBand,
    setBullMarketBand,
    mas,
    removeMa,
    bollinger,
    setBollinger,
    onChain,
    setOnChain,
    rsi,
    setRsi,
    macd,
    setMacd,
    stoch,
    setStoch,
  ])
}

export function ChartIndicatorLegend({
  goldenCrossState,
  onOpenSettings,
  className,
  variant = 'overlay',
}: ChartIndicatorLegendProps) {
  const rows = useLegendRows(goldenCrossState)

  if (rows.length === 0) return null

  if (variant === 'strip') {
    return (
      <div
        className={cn(
          'shrink-0 border-b border-white/[0.06] bg-[#0a0a0a]/95 px-1 py-1.5',
          className,
        )}
        aria-label="Indicadores activos"
      >
        <div className="mb-1 flex items-center justify-between gap-2 px-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Indicadores ({rows.length})
          </p>
          {onOpenSettings ? (
            <button
              type="button"
              className="shrink-0 text-[10px] font-medium text-[#d4af37] hover:underline"
              onClick={() => onOpenSettings('on-chain')}
            >
              Ajustar
            </button>
          ) : null}
        </div>
        <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:thin]">
          {rows.map((row) => (
            <LegendPill
              key={row.id}
              row={row}
              onOpenSettings={onOpenSettings}
              compact
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'pointer-events-auto absolute left-2 top-2 z-20 flex max-w-[min(calc(100%-5rem),16rem)] flex-col gap-1 sm:max-w-[min(calc(100%-1rem),22rem)]',
        className,
      )}
      aria-label="Indicadores no gráfico"
    >
      {rows.map((row) => (
        <LegendPill key={row.id} row={row} onOpenSettings={onOpenSettings} />
      ))}
    </div>
  )
}
