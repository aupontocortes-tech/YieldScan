'use client'

import { Maximize2, Minimize2, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChartLandscapeContext } from '@/components/btc-dashboard/chart-landscape-context'
import { cn } from '@/lib/utils'

type ChartFullscreenButtonProps = {
  className?: string
  showLabel?: boolean
  /** Só ao entrar em ecrã cheio (ex.: fechar painel lateral). */
  onEnter?: () => void
}

/** Ampliar / sair do ecrã cheio — desktop e mobile. */
export function ChartFullscreenButton({
  className,
  showLabel = true,
  onEnter,
}: ChartFullscreenButtonProps) {
  const ctx = useChartLandscapeContext()
  if (!ctx) return null

  const { expanded, toggleFullscreen, exitExpanded } = ctx

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        'h-8 gap-1 px-2 text-[11px]',
        expanded
          ? 'bg-[#d4af37]/20 text-[#d4af37]'
          : 'text-zinc-400 hover:bg-white/5 hover:text-[#d4af37]',
        className,
      )}
      onClick={() => {
        if (expanded) {
          exitExpanded()
        } else {
          toggleFullscreen()
          onEnter?.()
        }
      }}
      aria-pressed={expanded}
      title={expanded ? 'Sair do ecrã cheio' : 'Ampliar gráfico'}
    >
      {expanded ? (
        <Minimize2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <Maximize2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      {showLabel ? (
        <span className="font-medium">{expanded ? 'Sair' : 'Ampliar'}</span>
      ) : null}
    </Button>
  )
}

/** Ampliar (todos) + Rodar (só mobile). */
export function ChartLandscapeToggle() {
  const ctx = useChartLandscapeContext()
  if (!ctx) return null

  const { rotateActive, toggleRotated, isMobile } = ctx

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <ChartFullscreenButton />
      {isMobile ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 gap-1 px-2 text-[11px]',
            rotateActive
              ? 'bg-[#d4af37]/20 text-[#d4af37]'
              : 'text-zinc-400 hover:bg-white/5 hover:text-[#d4af37]',
          )}
          onClick={toggleRotated}
          aria-pressed={rotateActive}
          title={
            rotateActive
              ? 'Voltar à vertical'
              : 'Rodar para paisagem (segura o telemóvel na horizontal)'
          }
        >
          <Smartphone
            className={cn('h-3.5 w-3.5 shrink-0', rotateActive ? 'rotate-0' : '-rotate-90')}
            aria-hidden
          />
          <span className="font-medium">{rotateActive ? 'Vertical' : 'Rodar'}</span>
        </Button>
      ) : null}
    </div>
  )
}
