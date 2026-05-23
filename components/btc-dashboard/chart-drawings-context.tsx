'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import {
  getDrawingTool,
  type DrawingActionId,
  type DrawingToolId,
  type DrawingToolMeta,
} from '@/lib/btc/chart-drawings-config'
import type {
  ChartPoint,
  DrawingDraft,
  MainChartApi,
  PlacedDrawing,
} from '@/lib/btc/chart-drawing-types'
import type { OhlcvBar } from '@/lib/btc/types'
import {
  createDrawing,
  useDrawingStore,
} from '@/lib/drawing-system/store/drawing-store'
import {
  DRAWING_TYPE_LABELS,
  drawingTypeToToolId,
  resolveToolMode,
  toolIdToDrawingType,
} from '@/lib/drawing-system/tools/tool-registry'
import type { Drawing, DrawingType } from '@/lib/drawing-system/types'

type DrawingPrefs = {
  drawingsVisible: boolean
  drawingsLocked: boolean
  continueDrawing: boolean
  weakMagnet: boolean
}

type ChartDrawingsContextValue = {
  activeToolId: DrawingToolId | null
  setActiveToolId: (id: DrawingToolId | null) => void
  favoriteTools: DrawingToolMeta[]
  toggleFavorite: (id: DrawingToolId) => void
  isFavorite: (id: DrawingToolId) => boolean
  drawingsVisible: boolean
  drawingsLocked: boolean
  continueDrawing: boolean
  weakMagnet: boolean
  runDrawingAction: (action: DrawingActionId) => void
  selectTool: (tool: DrawingToolMeta) => void
  instances: PlacedDrawing[]
  draft: DrawingDraft | null
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  removeInstance: (id: string) => void
  clearAllInstances: () => void
  registerMainChart: (api: MainChartApi | null) => void
  mainChart: MainChartApi | null
  bars: OhlcvBar[]
  setBars: (bars: OhlcvBar[]) => void
  commitDraft: (draft: DrawingDraft) => void
  setDraft: (draft: DrawingDraft | null) => void
  updateInstance: (id: string, points: ChartPoint[]) => void
  requestRedraw: () => void
  redrawVersion: number
}

const ChartDrawingsContext = createContext<ChartDrawingsContextValue | null>(null)

const GEOMETRY_BY_TYPE: Record<DrawingType, PlacedDrawing['geometry']> = {
  ruler: 'ruler',
  trendLine: 'line',
  horizontalLine: 'horizontal',
  verticalLine: 'vertical',
  rectangle: 'rectangle',
  fibonacci: 'fib',
  text: 'text',
  brush: 'brush',
}

function drawingToPlaced(d: Drawing): PlacedDrawing {
  const toolId = (d.toolId ?? drawingTypeToToolId(d.type)) as DrawingToolId
  const meta = getDrawingTool(toolId)
  return {
    id: d.id,
    toolId,
    label: meta?.label ?? DRAWING_TYPE_LABELS[d.type],
    geometry: GEOMETRY_BY_TYPE[d.type],
    points: d.points,
    text: d.text,
    locked: d.locked,
  }
}

function readLegacyInstances(key: string): PlacedDrawing[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as PlacedDrawing[]) : []
  } catch {
    return []
  }
}

export function ChartDrawingsProvider({ children }: { children: ReactNode }) {
  const { pair, timeframe } = useBtcSettings()
  const scopeKey = `${pair.id}:${timeframe.id}`
  const legacyKey = `yieldscan:placed-drawings:${pair.id}:${timeframe.id}`

  const [mainChart, setMainChart] = useState<MainChartApi | null>(null)
  const [bars, setBars] = useState<OhlcvBar[]>([])

  const activeToolId = useDrawingStore((s) => s.activeToolId) as DrawingToolId | null
  const favoriteToolIds = useDrawingStore((s) => s.favoriteToolIds)
  const prefs = useDrawingStore((s) => s.prefs)
  const selectedId = useDrawingStore((s) => s.selectedId)
  const revision = useDrawingStore((s) => s.revision)
  const storeDraft = useDrawingStore((s) => s.draft)
  const drawings = useDrawingStore((s) => s.byScope[s.scopeKey]?.drawings ?? [])

  useEffect(() => {
    useDrawingStore.getState().setScope(scopeKey)
    const scope = useDrawingStore.getState().byScope[scopeKey]
    if (!scope?.drawings.length) {
      const legacy = readLegacyInstances(legacyKey)
      if (legacy.length) {
        const migrated = legacy
          .map((p) => {
            const type = toolIdToDrawingType(p.toolId)
            if (!type) return null
            return createDrawing(type, p.points, {
              text: p.text,
              id: p.id,
            })
          })
          .filter((d): d is Drawing => d != null)
        if (migrated.length) {
          useDrawingStore.getState().hydrateScopeDrawings(scopeKey, migrated)
        }
      }
    }
  }, [scopeKey, legacyKey])

  const instances = useMemo(() => drawings.map(drawingToPlaced), [drawings])

  const draft = useMemo((): DrawingDraft | null => {
    if (!storeDraft) return null
    const toolId = drawingTypeToToolId(storeDraft.type)
    return {
      toolId,
      label: DRAWING_TYPE_LABELS[storeDraft.type],
      geometry: GEOMETRY_BY_TYPE[storeDraft.type],
      points: storeDraft.points,
      preview: storeDraft.preview,
    }
  }, [storeDraft])

  const requestRedraw = useCallback(() => {
    useDrawingStore.getState().bumpRevision()
  }, [])

  const registerMainChart = useCallback(
    (api: MainChartApi | null) => {
      setMainChart(api)
      requestRedraw()
    },
    [requestRedraw],
  )

  const setActiveToolId = useCallback((id: DrawingToolId | null) => {
    useDrawingStore.getState().setActiveTool(id)
    useDrawingStore.getState().setDraft(null)
    if (!id || id === 'eraser') useDrawingStore.getState().select(null)
  }, [])

  const toggleFavorite = useCallback((id: DrawingToolId) => {
    useDrawingStore.getState().toggleFavorite(id)
  }, [])

  const isFavorite = useCallback(
    (id: DrawingToolId) => favoriteToolIds.includes(id),
    [favoriteToolIds],
  )

  const clearAllInstances = useCallback(() => {
    useDrawingStore.getState().removeAllDrawings()
  }, [])

  const removeInstance = useCallback((id: string) => {
    useDrawingStore.getState().removeDrawing(id)
  }, [])

  const setSelectedId = useCallback((id: string | null) => {
    useDrawingStore.getState().select(id)
  }, [])

  const updateInstance = useCallback((id: string, points: ChartPoint[]) => {
    useDrawingStore.getState().updateDrawing(id, (d) => ({ ...d, points }))
  }, [])

  const setDraft = useCallback(
    (d: DrawingDraft | null) => {
      if (!d) {
        useDrawingStore.getState().setDraft(null)
        return
      }
      const type = toolIdToDrawingType(d.toolId)
      if (!type) return
      useDrawingStore.getState().setDraft({
        type,
        toolId: d.toolId,
        points: d.points,
        preview: d.preview,
      })
    },
    [],
  )

  const commitDraft = useCallback((d: DrawingDraft) => {
    const type = toolIdToDrawingType(d.toolId)
    if (!type) return
    useDrawingStore.getState().addDrawing(
      createDrawing(type, d.points, { toolId: d.toolId, text: d.text }),
    )
  }, [])

  const runDrawingAction = useCallback(
    (action: DrawingActionId) => {
      const store = useDrawingStore.getState()
      switch (action) {
        case 'hide':
          store.setPrefs({ drawingsVisible: !store.prefs.drawingsVisible })
          break
        case 'lock-all':
          store.setPrefs({ drawingsLocked: !store.prefs.drawingsLocked })
          break
        case 'remove-all':
          store.setActiveTool(null)
          store.removeAllDrawings()
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('yieldscan:drawings-remove-all'))
          }
          break
        case 'continue-drawing':
          store.setPrefs({ continueDrawing: !store.prefs.continueDrawing })
          break
        case 'weak-magnet':
          store.setPrefs({ weakMagnet: !store.prefs.weakMagnet })
          break
        case 'zoom-in':
          window.dispatchEvent(new CustomEvent('yieldscan:chart-zoom', { detail: { direction: 'in' } }))
          break
        case 'zoom-out':
          window.dispatchEvent(new CustomEvent('yieldscan:chart-zoom', { detail: { direction: 'out' } }))
          break
      }
      requestRedraw()
    },
    [requestRedraw],
  )

  const selectTool = useCallback(
    (tool: DrawingToolMeta) => {
      if (tool.kind === 'action' && tool.action) {
        runDrawingAction(tool.action)
        return
      }
      const store = useDrawingStore.getState()
      const next = store.activeToolId === tool.id ? null : tool.id
      store.setActiveTool(next)
      store.setDraft(null)
      if (next === 'eraser') store.select(null)
    },
    [runDrawingAction],
  )

  const favoriteTools = useMemo(
    () =>
      favoriteToolIds
        .map((id) => getDrawingTool(id as DrawingToolId))
        .filter((t): t is DrawingToolMeta => t != null),
    [favoriteToolIds],
  )

  const value = useMemo(
    () => ({
      activeToolId,
      setActiveToolId,
      favoriteTools,
      toggleFavorite,
      isFavorite,
      drawingsVisible: prefs.drawingsVisible,
      drawingsLocked: prefs.drawingsLocked,
      continueDrawing: prefs.continueDrawing,
      weakMagnet: prefs.weakMagnet,
      runDrawingAction,
      selectTool,
      instances,
      draft,
      selectedId,
      setSelectedId,
      removeInstance,
      clearAllInstances,
      registerMainChart,
      mainChart,
      bars,
      setBars,
      commitDraft,
      setDraft,
      updateInstance,
      requestRedraw,
      redrawVersion: revision,
    }),
    [
      activeToolId,
      setActiveToolId,
      favoriteTools,
      toggleFavorite,
      isFavorite,
      prefs,
      runDrawingAction,
      selectTool,
      instances,
      draft,
      selectedId,
      setSelectedId,
      removeInstance,
      clearAllInstances,
      mainChart,
      bars,
      commitDraft,
      setDraft,
      updateInstance,
      requestRedraw,
      revision,
    ],
  )

  return <ChartDrawingsContext.Provider value={value}>{children}</ChartDrawingsContext.Provider>
}

export function useChartDrawings() {
  const c = useContext(ChartDrawingsContext)
  if (!c) throw new Error('useChartDrawings must be used within ChartDrawingsProvider')
  return c
}
