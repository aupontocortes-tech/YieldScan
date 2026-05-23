'use client'

import { useChartDrawings } from '@/components/btc-dashboard/chart-drawings-context'
import { getDrawingTool } from '@/lib/btc/chart-drawings-config'
import { useDrawingStore } from '@/lib/drawing-system/store/drawing-store'
import { isMultiClickTool } from '@/lib/drawing-system/tools/tool-registry'

/** Barra acima do gráfico quando há ferramenta de desenho activa. */
export function ChartDrawingActiveBanner() {
  const { activeToolId, drawingsVisible, drawingsLocked } = useChartDrawings()
  const draft = useDrawingStore((s) => s.transient.draft)
  const activeDrawing = activeToolId ? getDrawingTool(activeToolId) : null
  if (!activeDrawing || activeDrawing.kind !== 'draw') return null

  let hint = activeDrawing.hint
  if (activeToolId === 'ruler') {
    hint = 'Clica e arrasta para medir (como no TradingView)'
  } else if (draft?.toolId === activeToolId && activeToolId && isMultiClickTool(activeToolId)) {
    const need = draft.requiredPoints ?? 0
    const cur = draft.points.length
    if (need >= 99) {
      hint = `Ponto ${cur} — clica para adicionar · Enter para concluir · Esc cancela`
    } else {
      hint = `Ponto ${cur} de ${need} — clica no gráfico para o próximo vértice`
    }
  }

  return (
    <div className="mb-2 shrink-0 rounded-lg border border-[#d4af37]/25 bg-[#d4af37]/8 px-3 py-2 text-[11px] text-zinc-300">
      <span className="font-medium text-[#d4af37]">Desenho: </span>
      {activeDrawing.label}
      <span className="text-zinc-500"> — {hint}</span>
      {!drawingsVisible && <span className="text-zinc-500"> · ocultos</span>}
      {drawingsLocked && <span className="text-zinc-500"> · bloqueados</span>}
    </div>
  )
}
