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
}

function statusToneClass(tone?: LegendRow['statusTone']) {
  if (tone === 'bull') return 'text-emerald-400/90'
  if (tone === 'bear') return 'text-red-300/90'
  return 'text-zinc-500'
}

function LegendPill({
  row,
  onOpenSettings,
}: {
  row: LegendRow
  onOpenSettings?: (focus: ChartLegendSettingsFocus) => void
}) {
  return (
    <div
      className={cn(
        'flex max-w-full items-center gap-1.5 rounded-md border border-white/[0.12] bg-black/90 py-1 pl-1.5 pr-1 shadow-md backdrop-blur-sm',
        row.statusTone === 'bear' && 'border-red-500/25',
        row.statusTone === 'bull' && 'border-emerald-500/25',
      )}
    >
      <div className="flex shrink-0 items-center gap-0.5">
        {row.colors.map((c, i) => (
          <span
            key={`${row.id}-${i}`}
            className="h-2.5 w-2.5 rounded-[2px] border border-white/10"
            style={{ backgroundColor: c }}
            aria-hidden
          />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium leading-tight text-zinc-100">{row.label}</p>
        {row.status ? (
          <p className={cn('truncate text-[9px] leading-snug', statusToneClass(row.statusTone))}>
            {row.status}
          </p>
        ) : null}
      </div>
      {onOpenSettings ? (
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
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function ChartIndicatorLegend({
  goldenCrossState,
  onOpenSettings,
  className,
}: ChartIndicatorLegendProps) {
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

  const rows = useMemo(() => {
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

  if (rows.length === 0) return null

  return (
    <div
      className={cn(
        'pointer-events-auto absolute left-2 top-2 z-20 flex max-w-[min(calc(100%-1rem),22rem)] flex-col gap-1',
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
