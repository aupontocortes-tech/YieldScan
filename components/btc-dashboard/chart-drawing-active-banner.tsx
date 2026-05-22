'use client'

import { useChartDrawings } from '@/components/btc-dashboard/chart-drawings-context'
import { getDrawingTool } from '@/lib/btc/chart-drawings-config'

/** Barra acima do gráfico quando há ferramenta de desenho activa. */
export function ChartDrawingActiveBanner() {
  const { activeToolId, drawingsVisible, drawingsLocked } = useChartDrawings()
  const activeDrawing = activeToolId ? getDrawingTool(activeToolId) : null
  if (!activeDrawing || activeDrawing.kind !== 'draw') return null

  return (
    <div className="mb-2 shrink-0 rounded-lg border border-[#d4af37]/25 bg-[#d4af37]/8 px-3 py-2 text-[11px] text-zinc-300">
      <span className="font-medium text-[#d4af37]">Desenho: </span>
      {activeDrawing.label}
      <span className="text-zinc-500"> — {activeDrawing.hint}</span>
      {!drawingsVisible && <span className="text-zinc-500"> · ocultos</span>}
      {drawingsLocked && <span className="text-zinc-500"> · bloqueados</span>}
    </div>
  )
}
