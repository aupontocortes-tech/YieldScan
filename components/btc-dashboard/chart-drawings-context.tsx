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
import {
  getDrawingTool,
  type DrawingActionId,
  type DrawingToolId,
  type DrawingToolMeta,
} from '@/lib/btc/chart-drawings-config'

const FAVORITES_KEY = 'yieldscan:chart-drawing-favorites'
const ACTIVE_KEY = 'yieldscan:chart-drawing-active'
const PREFS_KEY = 'yieldscan:chart-drawing-prefs'

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
}

const ChartDrawingsContext = createContext<ChartDrawingsContextValue | null>(null)

function readJsonArray(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function readPrefs(): DrawingPrefs {
  if (typeof window === 'undefined') {
    return { drawingsVisible: true, drawingsLocked: false, continueDrawing: false, weakMagnet: false }
  }
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { drawingsVisible: true, drawingsLocked: false, continueDrawing: false, weakMagnet: false }
    const p = JSON.parse(raw) as Partial<DrawingPrefs>
    return {
      drawingsVisible: p.drawingsVisible !== false,
      drawingsLocked: p.drawingsLocked === true,
      continueDrawing: p.continueDrawing === true,
      weakMagnet: p.weakMagnet === true,
    }
  } catch {
    return { drawingsVisible: true, drawingsLocked: false, continueDrawing: false, weakMagnet: false }
  }
}

export function ChartDrawingsProvider({ children }: { children: ReactNode }) {
  const [activeToolId, setActiveToolIdState] = useState<DrawingToolId | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<DrawingToolId[]>([])
  const [prefs, setPrefs] = useState<DrawingPrefs>(readPrefs)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setFavoriteIds(readJsonArray(FAVORITES_KEY))
    const active = localStorage.getItem(ACTIVE_KEY)
    setActiveToolIdState(active || null)
    setPrefs(readPrefs())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds))
  }, [favoriteIds, hydrated])

  useEffect(() => {
    if (!hydrated) return
    if (activeToolId) localStorage.setItem(ACTIVE_KEY, activeToolId)
    else localStorage.removeItem(ACTIVE_KEY)
  }, [activeToolId, hydrated])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  }, [prefs, hydrated])

  const setActiveToolId = useCallback((id: DrawingToolId | null) => {
    setActiveToolIdState(id)
  }, [])

  const toggleFavorite = useCallback((id: DrawingToolId) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const isFavorite = useCallback((id: DrawingToolId) => favoriteIds.includes(id), [favoriteIds])

  const runDrawingAction = useCallback(
    (action: DrawingActionId) => {
      switch (action) {
        case 'hide':
          setPrefs((p) => ({ ...p, drawingsVisible: !p.drawingsVisible }))
          break
        case 'lock-all':
          setPrefs((p) => ({ ...p, drawingsLocked: !p.drawingsLocked }))
          break
        case 'remove-all':
          setActiveToolIdState(null)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('yieldscan:drawings-remove-all'))
          }
          break
        case 'continue-drawing':
          setPrefs((p) => ({ ...p, continueDrawing: !p.continueDrawing }))
          break
        case 'weak-magnet':
          setPrefs((p) => ({ ...p, weakMagnet: !p.weakMagnet }))
          break
        case 'zoom-in':
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('yieldscan:chart-zoom', { detail: { direction: 'in' } }))
          }
          break
        case 'zoom-out':
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('yieldscan:chart-zoom', { detail: { direction: 'out' } }))
          }
          break
      }
    },
    [],
  )

  const selectTool = useCallback(
    (tool: DrawingToolMeta) => {
      if (tool.kind === 'action' && tool.action) {
        runDrawingAction(tool.action)
        return
      }
      setActiveToolIdState((prev) => (prev === tool.id ? null : tool.id))
    },
    [runDrawingAction],
  )

  const favoriteTools = useMemo(
    () =>
      favoriteIds
        .map((id) => getDrawingTool(id))
        .filter((t): t is DrawingToolMeta => t != null),
    [favoriteIds],
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
    ],
  )

  return <ChartDrawingsContext.Provider value={value}>{children}</ChartDrawingsContext.Provider>
}

export function useChartDrawings() {
  const c = useContext(ChartDrawingsContext)
  if (!c) throw new Error('useChartDrawings must be used within ChartDrawingsProvider')
  return c
}
