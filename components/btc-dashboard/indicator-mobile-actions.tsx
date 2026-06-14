'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PenLine, Radar, RotateCcw, SlidersHorizontal } from 'lucide-react'

type Props = {
  trendRadarOn: boolean
  indicatorsOpen: boolean
  drawingsOpen: boolean
  onToggleRadar: () => void
  onOpenIndicators: () => void
  onOpenDrawings: () => void
  onResetLayout: () => void
}

const TOOL_BTN =
  'h-10 shrink-0 snap-start gap-1.5 rounded-md px-3 text-xs touch-manipulation active:scale-[0.98]'

/** Barra de ferramentas no telemóvel — toque directo (sem dropdown). */
export function IndicatorMobileToolbar({
  trendRadarOn,
  indicatorsOpen,
  drawingsOpen,
  onToggleRadar,
  onOpenIndicators,
  onOpenDrawings,
  onResetLayout,
}: Props) {
  return (
    <nav
      aria-label="Ferramentas do gráfico"
      data-no-swipe-nav
      className="col-span-2 flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain rounded-lg border border-white/[0.06] bg-black/40 px-1 py-1 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch] snap-x snap-mandatory"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          TOOL_BTN,
          trendRadarOn
            ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/35'
            : 'text-zinc-400 hover:bg-white/5 hover:text-violet-300',
        )}
        onClick={onToggleRadar}
      >
        <Radar className="h-3.5 w-3.5 shrink-0" />
        Radar
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          TOOL_BTN,
          indicatorsOpen
            ? 'bg-[#d4af37]/15 text-[#d4af37]'
            : 'text-zinc-400 hover:bg-white/5 hover:text-[#d4af37]',
        )}
        onClick={onOpenIndicators}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
        Indicadores
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          TOOL_BTN,
          drawingsOpen
            ? 'bg-[#d4af37]/15 text-[#d4af37]'
            : 'text-zinc-400 hover:bg-white/5 hover:text-[#d4af37]',
        )}
        onClick={onOpenDrawings}
      >
        <PenLine className="h-3.5 w-3.5 shrink-0" />
        Desenhos
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(TOOL_BTN, 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200')}
        onClick={onResetLayout}
        title="Reajusta zoom dos gráficos"
      >
        <RotateCcw className="h-3.5 w-3.5 shrink-0" />
        Layout
      </Button>
    </nav>
  )
}
