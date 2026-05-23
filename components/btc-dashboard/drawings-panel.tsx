'use client'

import { useMemo, useRef, useState } from 'react'
import { useChartDrawings } from '@/components/btc-dashboard/chart-drawings-context'
import { DrawingTvIcon } from '@/components/btc-dashboard/drawing-tv-icon'
import {
  DRAWING_PANEL_TAB_IDS,
  getCategoryMeta,
  getToolsForCategory,
  searchDrawingTools,
  type DrawingCategoryId,
  type DrawingToolMeta,
} from '@/lib/btc/chart-drawings-config'
import { cn } from '@/lib/utils'
import { MoreVertical, Search } from 'lucide-react'

const SPLIT_ACTIONS = new Set(['hide-drawings', 'weak-magnet', 'remove-all'])

function ToolTile({
  tool,
  active,
  actionOn,
  onSelect,
  onLongPressFavorite,
  isFavorite,
}: {
  tool: DrawingToolMeta
  active: boolean
  actionOn?: boolean
  onSelect: () => void
  onLongPressFavorite: () => void
  isFavorite: boolean
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasSplit = tool.kind === 'action' && SPLIT_ACTIONS.has(tool.id)

  const startLong = () => {
    if (tool.kind !== 'draw') return
    timerRef.current = setTimeout(() => {
      onLongPressFavorite()
    }, 500)
  }
  const cancelLong = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  if (hasSplit) {
    return (
      <div
        className={cn(
          'flex min-h-[100px] overflow-hidden rounded-xl bg-[#2c2c2e]',
          (active || actionOn) && 'ring-1 ring-white/30',
        )}
      >
        <button
          type="button"
          title={tool.hint}
          onClick={onSelect}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 px-1 py-3"
        >
          <DrawingTvIcon toolId={tool.id} />
          <span className="line-clamp-2 px-1 text-center text-[11px] leading-tight text-[#e5e5e7]">
            {tool.label}
          </span>
        </button>
        <button
          type="button"
          className="flex w-9 shrink-0 items-center justify-center border-l border-[#3a3a3c] text-[#8e8e93] hover:text-white"
          aria-label={`Opções: ${tool.label}`}
          onClick={onSelect}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      title={tool.hint + (tool.kind === 'draw' ? ' · mantém premido para favorito' : '')}
      onClick={onSelect}
      onPointerDown={startLong}
      onPointerUp={cancelLong}
      onPointerLeave={cancelLong}
      className={cn(
        'relative flex min-h-[104px] w-full flex-col items-center justify-center gap-2 rounded-xl bg-[#252528] px-1.5 py-3.5 transition-colors hover:bg-[#2c2c2e]',
        (active || actionOn) && 'ring-1 ring-white/30',
        isFavorite && tool.kind === 'draw' && 'ring-1 ring-[#d4af37]/50',
      )}
    >
      <DrawingTvIcon toolId={tool.id} />
      <span className="line-clamp-2 px-1 text-center text-[11px] leading-tight text-[#e5e5e7]">
        {tool.label}
      </span>
    </button>
  )
}

export function DrawingsPanel() {
  const {
    activeToolId,
    selectTool,
    favoriteTools,
    toggleFavorite,
    isFavorite,
    drawingsVisible,
    drawingsLocked,
    continueDrawing,
    weakMagnet,
  } = useChartDrawings()

  const [tab, setTab] = useState<DrawingCategoryId>('tools')
  const [query, setQuery] = useState('')

  const panelTabs = useMemo(
    () =>
      DRAWING_PANEL_TAB_IDS.map((id) => getCategoryMeta(id)).filter(
        (c): c is NonNullable<typeof c> => c != null,
      ),
    [],
  )

  const activeCategory = getCategoryMeta(tab)

  const tools = useMemo(() => {
    const q = query.trim()
    if (q) return searchDrawingTools(q)
    if (tab === 'favorites') return favoriteTools
    return getToolsForCategory(tab)
  }, [query, tab, favoriteTools])

  const actionActive = (tool: DrawingToolMeta) => {
    if (!tool.action) return false
    switch (tool.action) {
      case 'hide':
        return !drawingsVisible
      case 'lock-all':
        return drawingsLocked
      case 'continue-drawing':
        return continueDrawing
      case 'weak-magnet':
        return weakMagnet
      default:
        return false
    }
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#636366]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar"
          className="h-11 w-full rounded-xl bg-[#1c1c1e] pl-10 pr-3 text-[15px] text-white placeholder:text-[#636366] focus:outline-none focus:ring-1 focus:ring-white/20"
        />
      </div>

      {!query.trim() && (
        <>
          {/* Abas em grelha (todas visíveis — sem scroll escondido) */}
          <div className="mb-2 grid grid-cols-4 gap-1.5 sm:grid-cols-4" role="tablist">
            {panelTabs.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={tab === cat.id}
                onClick={() => setTab(cat.id)}
                className={cn(
                  'rounded-lg px-2 py-2 text-center text-[11px] font-medium leading-tight transition-colors',
                  tab === cat.id
                    ? 'bg-[#3a3a3c] text-white ring-1 ring-white/20'
                    : 'bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-[#c7c7cc]',
                  cat.id === 'patterns' && tab !== cat.id && 'ring-1 ring-[#2962ff]/25',
                  cat.id === 'forecasts' && tab !== cat.id && 'ring-1 ring-[#26a69a]/25',
                )}
              >
                {cat.tabLabel}
              </button>
            ))}
          </div>
          {activeCategory && (
            <p className="mb-3 text-[13px] font-semibold text-[#e5e5e7]">{activeCategory.title}</p>
          )}
        </>
      )}

      {!drawingsVisible && (
        <p className="mb-2 rounded-lg bg-[#2c2c2e] px-3 py-2 text-[12px] text-[#8e8e93]">
          Desenhos ocultos — toca em «Ocultar desenhos» para mostrar.
        </p>
      )}

      {tab === 'favorites' && !query.trim() && tools.length === 0 ? (
        <p className="py-10 text-center text-[13px] leading-relaxed text-[#8e8e93]">
          Mantém premida uma ferramenta para a adicionares aos favoritos.
        </p>
      ) : tools.length === 0 && !query.trim() ? (
        <p className="py-10 text-center text-[13px] text-[#8e8e93]">
          Nenhuma ferramenta nesta categoria.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2.5 pb-2">
          {tools.map((tool) => (
            <li key={tool.id}>
              <ToolTile
                tool={tool}
                active={activeToolId === tool.id}
                actionOn={actionActive(tool)}
                onSelect={() => selectTool(tool)}
                onLongPressFavorite={() => toggleFavorite(tool.id)}
                isFavorite={isFavorite(tool.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {query.trim() && tools.length === 0 && (
        <p className="py-10 text-center text-[13px] text-[#8e8e93]">Nenhuma ferramenta encontrada.</p>
      )}
    </div>
  )
}
