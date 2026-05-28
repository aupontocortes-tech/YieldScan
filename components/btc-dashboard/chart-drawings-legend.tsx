'use client'

import { useChartDrawings } from '@/components/btc-dashboard/chart-drawings-context'
import { getDrawingTool } from '@/lib/btc/chart-drawings-config'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { Settings2, X } from 'lucide-react'

/** Lista de desenhos no gráfico — estilo legenda TradingView. */
export function ChartDrawingsLegend() {
  const {
    instances,
    selectedId,
    setSelectedId,
    removeInstance,
    drawingsVisible,
    setActiveToolId,
  } = useChartDrawings()
  const isMobile = useIsMobile()

  if (!drawingsVisible || instances.length === 0) return null

  return (
    <div
      className={cn(
        'pointer-events-auto absolute z-20 flex max-w-[min(100%,280px)] flex-col gap-1',
        isMobile
          ? 'bottom-10 right-1 max-h-[28%] overflow-y-auto [scrollbar-width:thin]'
          : 'right-2 top-2',
      )}
    >
      {instances.map((d) => {
        const meta = getDrawingTool(d.toolId)
        const label = meta?.label ?? d.label
        const selected = selectedId === d.id
        return (
          <div
            key={d.id}
            className={cn(
              'flex items-center gap-1 rounded-md border bg-black/75 py-0.5 pl-2 pr-0.5 text-[11px] backdrop-blur-sm',
              selected ? 'border-[#2962ff]/60' : 'border-white/10',
            )}
          >
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-zinc-200"
              onClick={() => setSelectedId(selected ? null : d.id)}
            >
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#2962ff]" />
              {label}
            </button>
            <button
              type="button"
              className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
              aria-label={`Definições ${label}`}
              onClick={() => setActiveToolId(d.toolId)}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-red-400"
              aria-label={`Remover ${label}`}
              onClick={() => removeInstance(d.id)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
