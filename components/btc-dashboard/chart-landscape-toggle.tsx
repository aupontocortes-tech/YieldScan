'use client'

import { Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChartLandscapeContext } from '@/components/btc-dashboard/chart-landscape-context'
import { cn } from '@/lib/utils'

/** Botão visível no header (mobile) para girar o gráfico em paisagem. */
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
      title={active ? 'Voltar à vertical' : 'Girar ecrã — gráfico em horizontal'}
    >
      <Smartphone
        className={cn('h-3.5 w-3.5 shrink-0', active ? 'rotate-0' : '-rotate-90')}
        aria-hidden
      />
      <span className="font-medium">{active ? 'Vertical' : 'Girar'}</span>
    </Button>
  )
}
