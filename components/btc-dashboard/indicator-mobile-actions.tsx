'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PenLine, Radar, RefreshCw, RotateCcw, SlidersHorizontal } from 'lucide-react'

type Props = {
  trendRadarOn: boolean
  indicatorsOpen: boolean
  drawingsOpen: boolean
  onToggleRadar: () => void
  onOpenIndicators: () => void
  onOpenDrawings: () => void
  onResetLayout: () => void
  onResetAll: () => void
}

const TOOL_BTN =
  'inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-3 text-xs font-medium touch-manipulation select-none active:scale-[0.98]'

/** Barra de ferramentas no telemóvel — botões nativos para toque fiável. */
export function IndicatorMobileToolbar({
  trendRadarOn,
  indicatorsOpen,
  drawingsOpen,
  onToggleRadar,
  onOpenIndicators,
  onOpenDrawings,
  onResetLayout,
  onResetAll,
}: Props) {
  return (
    <nav
      aria-label="Ferramentas do gráfico"
      data-no-swipe-nav
      className="relative z-[1] col-span-2 row-start-3 flex min-w-0 touch-manipulation flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain rounded-lg border border-white/[0.06] bg-[#050505] px-1 py-1 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch] pointer-events-auto"
    >
      <ToolButton
        label="Radar"
        active={trendRadarOn}
        activeClass="bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/35"
        onPress={onToggleRadar}
      >
        <Radar className="h-3.5 w-3.5 shrink-0" />
      </ToolButton>
      <ToolButton
        label="Indicadores"
        active={indicatorsOpen}
        activeClass="bg-[#d4af37]/15 text-[#d4af37]"
        onPress={onOpenIndicators}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
      </ToolButton>
      <ToolButton
        label="Desenhos"
        active={drawingsOpen}
        activeClass="bg-[#d4af37]/15 text-[#d4af37]"
        onPress={onOpenDrawings}
      >
        <PenLine className="h-3.5 w-3.5 shrink-0" />
      </ToolButton>
      <ToolButton label="Layout" onPress={onResetLayout} title="Reajusta zoom dos gráficos">
        <RotateCcw className="h-3.5 w-3.5 shrink-0" />
      </ToolButton>
      <ToolButton label="Repor tudo" onPress={onResetAll} title="Repor indicadores e aparência ao padrão">
        <RefreshCw className="h-3.5 w-3.5 shrink-0" />
      </ToolButton>
    </nav>
  )
}

function ToolButton({
  label,
  active,
  activeClass,
  onPress,
  title,
  children,
}: {
  label: string
  active?: boolean
  activeClass?: string
  onPress: () => void
  title?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      className={cn(
        TOOL_BTN,
        active ? activeClass : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
      )}
      onClick={(e) => {
        e.stopPropagation()
        onPress()
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
      {label}
    </button>
  )
}
