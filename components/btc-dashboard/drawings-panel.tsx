'use client'

import { useMemo, useState } from 'react'
import { useChartDrawings } from '@/components/btc-dashboard/chart-drawings-context'
import { resolveDrawingIcon } from '@/components/btc-dashboard/drawing-tool-icons'
import {
  DRAWING_CATEGORIES,
  getDrawingTool,
  getToolsForCategory,
  searchDrawingTools,
  type DrawingCategoryId,
  type DrawingToolMeta,
} from '@/lib/btc/chart-drawings-config'
import { cn } from '@/lib/utils'
import { MoreVertical, Search, Star } from 'lucide-react'

const ACTION_WITH_MENU = new Set(['hide-drawings', 'weak-magnet', 'remove-all'])

function ToolTile({
  tool,
  active,
  fav,
  actionOn,
  onSelect,
  onToggleFavorite,
}: {
  tool: DrawingToolMeta
  active: boolean
  fav: boolean
  actionOn?: boolean
  onSelect: () => void
  onToggleFavorite: () => void
}) {
  const Icon = resolveDrawingIcon(tool.icon)
  const hasMenu = tool.kind === 'action' && ACTION_WITH_MENU.has(tool.id)

  return (
    <div
      className={cn(
        'relative flex min-h-[72px] flex-col rounded-lg border transition-colors',
        active || actionOn
          ? 'border-[#d4af37]/45 bg-[#d4af37]/10'
          : 'border-zinc-800/90 bg-zinc-900/50 hover:border-zinc-700',
      )}
    >
      {tool.kind === 'draw' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
          className="absolute right-1 top-1 z-10 rounded p-0.5 text-zinc-600 hover:text-[#d4af37]"
          aria-label={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Star className={cn('h-3 w-3', fav && 'fill-[#d4af37] text-[#d4af37]')} />
        </button>
      )}
      <button
        type="button"
        title={tool.hint}
        onClick={onSelect}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-1.5 px-1.5 py-2.5 text-center',
          hasMenu && 'pr-7',
        )}
      >
        <Icon
          className={cn('h-5 w-5 shrink-0', active || actionOn ? 'text-[#d4af37]' : 'text-zinc-300')}
          aria-hidden
        />
        <span className="line-clamp-2 text-[10px] leading-tight text-zinc-300">{tool.label}</span>
      </button>
      {hasMenu && (
        <button
          type="button"
          className="absolute bottom-0 right-0 flex h-full w-7 items-center justify-center border-l border-zinc-800/80 text-zinc-500 hover:text-zinc-300"
          aria-label={`Opções: ${tool.label}`}
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
        >
          <MoreVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
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

  const activeTool = activeToolId ? getDrawingTool(activeToolId) : null

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
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-[#d4af37]/40 focus:outline-none focus:ring-1 focus:ring-[#d4af37]/30"
        />
      </div>

      {!query.trim() && (
        <div
          className="-mx-1 flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin"
          role="tablist"
          aria-label="Categorias de desenhos"
        >
          {DRAWING_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={tab === cat.id}
              onClick={() => setTab(cat.id)}
              className={cn(
                'shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors',
                tab === cat.id
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200',
              )}
            >
              {cat.tabLabel}
            </button>
          ))}
        </div>
      )}

      {activeTool && activeTool.kind === 'draw' && (
        <div className="rounded-lg border border-[#d4af37]/25 bg-[#d4af37]/8 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#d4af37]/90">
            Ferramenta activa
          </p>
          <p className="text-sm text-white">{activeTool.label}</p>
        </div>
      )}

      {!drawingsVisible && (
        <p className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-[11px] text-zinc-400">
          Desenhos ocultos no gráfico. Toca em «Ocultar desenhos» para mostrar.
        </p>
      )}

      {tab === 'favorites' && !query.trim() && tools.length === 0 ? (
        <p className="py-6 text-center text-[11px] leading-relaxed text-zinc-500">
          Marca ferramentas com a estrela nas outras categorias para as veres em Favoritos.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {tools.map((tool) => (
            <li key={tool.id}>
              <ToolTile
                tool={tool}
                active={activeToolId === tool.id}
                fav={isFavorite(tool.id)}
                actionOn={actionActive(tool)}
                onSelect={() => selectTool(tool)}
                onToggleFavorite={() => toggleFavorite(tool.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {query.trim() && tools.length === 0 && (
        <p className="py-8 text-center text-xs text-zinc-500">Nenhuma ferramenta encontrada.</p>
      )}

      <p className="text-[10px] leading-relaxed text-zinc-600">
        Catálogo estilo TradingView. A colocação de desenhos no gráfico será ligada em seguida; favoritos,
        ferramentas de acção e seleção já ficam guardados.
      </p>
    </div>
  )
}
