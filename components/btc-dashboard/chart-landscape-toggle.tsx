'use client'

import { Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChartLandscapeContext } from '@/components/btc-dashboard/chart-landscape-context'
import { cn } from '@/lib/utils'

/** Botão visível no header (mobile) para ampliar o gráfico a ecrã cheio. */
export function ChartLandscapeToggle() {
  const ctx = useChartLandscapeContext()
  if (!ctx?.isMobile) return null

  const { active, toggle } = ctx

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        'h-8 gap-1 px-2 text-[11px] md:hidden',
        active
          ? 'bg-[#d4af37]/20 text-[#d4af37]'
          : 'text-zinc-400 hover:bg-white/5 hover:text-[#d4af37]',
      )}
      onClick={toggle}
      aria-pressed={active}
      title={
        active
          ? 'Sair do ecrã cheio'
          : 'Ampliar gráfico. Para paisagem, rode o telemóvel (não gira a interface).'
      }
    >
      {active ? (
        <Minimize2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <Maximize2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      <span className="font-medium">{active ? 'Sair' : 'Ampliar'}</span>
    </Button>
  )
}
