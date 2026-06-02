'use client'

import type { ChartLegendSettingsFocus } from '@/components/btc-dashboard/chart-indicator-legend'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import {
  CHART_LABEL_MODE_LABELS,
  compactIndicatorTitle,
} from '@/lib/btc/chart-indicator-display'
import type { ChartIndicatorLabelMode } from '@/lib/btc/types'
import { cn } from '@/lib/utils'
import { Settings2, X } from 'lucide-react'

export type ChartIndicatorQuickMenuState = {
  x: number
  y: number
  id: string
  /** Ids gravados em labelModes (ex.: golden cross = duas linhas). */
  labelIds?: string[]
  label: string
  colors: string[]
  settingsFocus: ChartLegendSettingsFocus
  onRemove: () => void
}

export function ChartIndicatorQuickMenu({
  menu,
  onClose,
  onOpenSettings,
}: {
  menu: ChartIndicatorQuickMenuState
  onClose: () => void
  onOpenSettings?: (focus: ChartLegendSettingsFocus) => void
}) {
  const { chartIndicatorDisplay, setIndicatorLabelMode } = useBtcSettings()
  const labelIds = menu.labelIds ?? [menu.id]
  const current =
    chartIndicatorDisplay.labelModes[labelIds[0]] ?? chartIndicatorDisplay.defaultLabelMode

  const pickMode = (mode: ChartIndicatorLabelMode) => {
    for (const id of labelIds) setIndicatorLabelMode(id, mode)
    onClose()
  }

  return (
    <div
      className="fixed z-[120] min-w-[168px] max-w-[min(92vw,14rem)] rounded-lg border border-white/12 bg-[#141414]/98 py-1.5 shadow-2xl backdrop-blur-md"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-2 border-b border-white/[0.06] px-2.5 pb-2 pt-0.5">
        <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
          {menu.colors.map((c, i) => (
            <span
              key={`${menu.id}-${i}`}
              className="h-2 w-2 rounded-[2px] border border-white/10"
              style={{ backgroundColor: c }}
              aria-hidden
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-zinc-100">{menu.label}</p>
          <p className="text-[9px] text-zinc-500">Rótulo no gráfico</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
          aria-label="Fechar"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex gap-0.5 px-2 py-2">
        {(['compact', 'full', 'hidden'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={cn(
              'flex-1 rounded-md border px-1 py-1 text-[9px] font-medium leading-tight transition-colors',
              current === mode
                ? 'border-[#d4af37]/50 bg-[#d4af37]/15 text-[#d4af37]'
                : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200',
            )}
            onClick={() => pickMode(mode)}
          >
            {CHART_LABEL_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      <p className="px-2.5 pb-1 text-[8px] leading-snug text-zinc-600">
        {current === 'compact'
          ? `Ex.: «${compactIndicatorTitle(menu.label)}» no eixo`
          : current === 'hidden'
            ? 'Linha visível, sem texto no eixo'
            : 'Nome e valor no eixo direito'}
      </p>

      <div className="mx-2 border-t border-white/[0.06]" />

      <div className="flex flex-col gap-0.5 p-1">
        {onOpenSettings ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-zinc-300 hover:bg-white/8"
            onClick={() => {
              onOpenSettings(menu.settingsFocus)
              onClose()
            }}
          >
            <Settings2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            Configurar indicador
          </button>
        ) : null}
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-red-300/90 hover:bg-red-500/10"
          onClick={() => {
            menu.onRemove()
            onClose()
          }}
        >
          <X className="h-3.5 w-3.5 shrink-0 opacity-70" />
          Remover do gráfico
        </button>
      </div>
    </div>
  )
}
