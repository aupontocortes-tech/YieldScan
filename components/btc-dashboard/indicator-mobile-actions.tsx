'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { LayoutGrid, MoreVertical, PenLine, Radar, RotateCcw, SlidersHorizontal } from 'lucide-react'

type Props = {
  trendRadarOn: boolean
  indicatorsOpen: boolean
  drawingsOpen: boolean
  onToggleRadar: () => void
  onOpenIndicators: () => void
  onOpenDrawings: () => void
  onResetLayout: () => void
}

/** Menu compacto no telemóvel — evita 4 botões minúsculos na barra. */
export function IndicatorMobileActionsMenu({
  trendRadarOn,
  indicatorsOpen,
  drawingsOpen,
  onToggleRadar,
  onOpenIndicators,
  onOpenDrawings,
  onResetLayout,
}: Props) {
  const active = trendRadarOn || indicatorsOpen || drawingsOpen

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-10 w-10 shrink-0',
            active ? 'bg-[#d4af37]/15 text-[#d4af37]' : 'text-zinc-400 hover:bg-white/5 hover:text-[#d4af37]',
          )}
          aria-label="Mais opções do gráfico"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[260] w-52 border-white/10 bg-[#141414] text-zinc-100">
        <DropdownMenuItem
          className={cn('gap-2 py-2.5', trendRadarOn && 'bg-violet-500/15 text-violet-200')}
          onClick={onToggleRadar}
        >
          <Radar className="h-4 w-4" />
          Radar de Tendência
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn('gap-2 py-2.5', indicatorsOpen && 'bg-[#d4af37]/15 text-[#d4af37]')}
          onClick={onOpenIndicators}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Indicadores
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn('gap-2 py-2.5', drawingsOpen && 'bg-[#d4af37]/15 text-[#d4af37]')}
          onClick={onOpenDrawings}
        >
          <PenLine className="h-4 w-4" />
          Desenhos
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem className="gap-2 py-2.5" onClick={onResetLayout}>
          <RotateCcw className="h-4 w-4" />
          Reajustar zoom
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 py-2.5 text-zinc-400" disabled>
          <LayoutGrid className="h-4 w-4" />
          Usa «Ampliar» para ecrã cheio
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
