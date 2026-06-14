'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Drawing, DrawingDraft, DrawingType, ChartPoint } from '@/lib/drawing-system/types'
import { DEFAULT_STYLE } from '@/lib/drawing-system/types'
import { createDefaultFibData } from '@/lib/drawing-system/tools/fib/FibMath'
import { createDebouncedStorage } from '@/lib/drawing-system/store/debounced-storage'
import { drawingTypeToToolId, getDefaultStyleForTool } from '@/lib/drawing-system/tools/tool-registry'
import type { DrawingToolId } from '@/lib/btc/chart-drawings-config'
import type { DrawingTransientState } from '@/lib/drawing-system/store/drawing-view-state'

type ScopeData = {
  drawings: Drawing[]
  past: Drawing[][]
  future: Drawing[][]
}

type DrawingPrefs = {
  drawingsVisible: boolean
  drawingsLocked: boolean
  continueDrawing: boolean
  weakMagnet: boolean
}

type DrawingStoreState = {
  scopeKey: string
  byScope: Record<string, ScopeData>
  selectedId: string | null
  hoveredId: string | null
  hoveredFibLevelIndex: number | null
  activeToolId: string | null
  draft: DrawingDraft | null
  transient: DrawingTransientState
  prefs: DrawingPrefs
  revision: number
  favoriteToolIds: string[]
}

type DrawingStoreActions = {
  setScope: (scopeKey: string) => void
  setActiveTool: (toolId: string | null) => void
  setDraft: (draft: DrawingDraft | null) => void
  setTransientDraft: (draft: DrawingDraft | null) => void
  setTransientMove: (move: DrawingTransientState['move']) => void
  clearTransient: () => void
  isGestureActive: () => boolean
  setHovered: (id: string | null) => void
  setHoveredFibLevel: (index: number | null) => void
  select: (id: string | null) => void
  pushHistory: () => void
  addDrawing: (drawing: Drawing) => void
  updateDrawing: (id: string, updater: (d: Drawing) => Drawing) => void
  removeDrawing: (id: string) => void
  removeAllDrawings: () => void
  setPrefs: (patch: Partial<DrawingPrefs>) => void
  toggleFavorite: (toolId: string) => void
  undo: () => void
  redo: () => void
  bumpRevision: () => void
  getDrawings: () => Drawing[]
  hydrateScopeDrawings: (scopeKey: string, drawings: Drawing[]) => void
  toggleDrawingLock: (id: string) => void
  toggleDrawingVisible: (id: string) => void
}

function emptyScope(): ScopeData {
  return { drawings: [], past: [], future: [] }
}

/** Referência estável para selectors React/Zustand (evita loop infinito). */
export const EMPTY_DRAWINGS: Drawing[] = []

function snapshot(drawings: Drawing[]): Drawing[] {
  return drawings.map((d) => ({
    ...d,
    points: d.points.map((p) => ({ ...p })),
    style: { ...d.style },
    fib: d.fib
      ? { ...d.fib, levels: d.fib.levels.map((l) => ({ ...l })) }
      : undefined,
  }))
}

function newId() {
  return `dr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function createDrawing(
  type: DrawingType,
  points: ChartPoint[],
  extra?: Partial<Drawing>,
): Drawing {
  const toolId = (extra?.toolId ?? drawingTypeToToolId(type)) as DrawingToolId
  const base: Drawing = {
    id: newId(),
    type,
    toolId,
    points,
    style: { ...getDefaultStyleForTool(toolId), ...extra?.style },
    visible: true,
    locked: false,
    zIndex: Date.now(),
    createdAt: Date.now(),
    ...extra,
    toolId,
  }
  if (type === 'fibonacci') {
    base.fib = extra?.fib ?? createDefaultFibData()
    base.style = { color: '#787B86', lineWidth: 1, ...base.style }
  }
  return base
}

function withScope(
  state: DrawingStoreState,
  scopeKey: string,
  updater: (scope: ScopeData) => ScopeData,
): Pick<DrawingStoreState, 'byScope'> {
  const current = state.byScope[scopeKey] ?? emptyScope()
  return { byScope: { ...state.byScope, [scopeKey]: updater(current) } }
}

export const useDrawingStore = create<DrawingStoreState & DrawingStoreActions>()(
  persist(
    (set, get) => ({
      scopeKey: 'default',
      byScope: {},
      selectedId: null,
      hoveredId: null,
      hoveredFibLevelIndex: null,
      activeToolId: null,
      draft: null,
      transient: { draft: null, move: null },
      prefs: {
        drawingsVisible: true,
        drawingsLocked: false,
        continueDrawing: false,
        weakMagnet: false,
      },
      revision: 0,
      favoriteToolIds: [],

      setScope: (scopeKey) =>
        set((s) => {
          if (s.scopeKey === scopeKey) return s
          return {
            scopeKey,
            selectedId: null,
            hoveredId: null,
            hoveredFibLevelIndex: null,
            draft: null,
            transient: { draft: null, move: null },
            byScope: s.byScope[scopeKey] ? s.byScope : { ...s.byScope, [scopeKey]: emptyScope() },
          }
        }),

      setActiveTool: (activeToolId) =>
        set({ activeToolId, draft: null, transient: { draft: null, move: null } }),

      setDraft: (draft) => set({ draft }),

      setTransientDraft: (draft) =>
        set((s) => ({
          transient: { ...s.transient, draft },
        })),

      setTransientMove: (move) =>
        set((s) => ({
          transient: { ...s.transient, move },
        })),

      clearTransient: () =>
        set((s) => ({
          transient: { draft: null, move: null },
          draft: null,
        })),

      isGestureActive: () => {
        const s = get()
        return Boolean(s.transient.draft || s.transient.move)
      },

      setHovered: (hoveredId) => set({ hoveredId, hoveredFibLevelIndex: null }),

      setHoveredFibLevel: (hoveredFibLevelIndex) => set({ hoveredFibLevelIndex }),

      select: (selectedId) => set((s) => ({ selectedId, revision: s.revision + 1 })),

      getDrawings: () => {
        const s = get()
        return s.byScope[s.scopeKey]?.drawings ?? EMPTY_DRAWINGS
      },

      pushHistory: () =>
        set((s) => {
          const scope = s.byScope[s.scopeKey] ?? emptyScope()
          const past = [...scope.past, snapshot(scope.drawings)].slice(-50)
          return {
            ...withScope(s, s.scopeKey, () => ({ ...scope, past, future: [] })),
            revision: s.revision + 1,
          }
        }),

      addDrawing: (drawing) =>
        set((s) => {
          const scope = s.byScope[s.scopeKey] ?? emptyScope()
          const past = [...scope.past, snapshot(scope.drawings)].slice(-50)
          const drawings = [...scope.drawings, drawing]
          return {
            ...withScope(s, s.scopeKey, () => ({ drawings, past, future: [] })),
            selectedId: drawing.id,
            draft: null,
            transient: { draft: null, move: null },
            revision: s.revision + 1,
            activeToolId: s.prefs.continueDrawing ? s.activeToolId : null,
          }
        }),

      updateDrawing: (id, updater) =>
        set((s) => ({
          ...withScope(s, s.scopeKey, (scope) => ({
            ...scope,
            drawings: scope.drawings.map((d) => (d.id === id ? updater(d) : d)),
          })),
          revision: s.revision + 1,
        })),

      removeDrawing: (id) =>
        set((s) => {
          const scope = s.byScope[s.scopeKey] ?? emptyScope()
          const past = [...scope.past, snapshot(scope.drawings)].slice(-50)
          return {
            ...withScope(s, s.scopeKey, () => ({
              drawings: scope.drawings.filter((d) => d.id !== id),
              past,
              future: [],
            })),
            selectedId: s.selectedId === id ? null : s.selectedId,
            revision: s.revision + 1,
          }
        }),

      removeAllDrawings: () =>
        set((s) => {
          const scope = s.byScope[s.scopeKey] ?? emptyScope()
          const past = [...scope.past, snapshot(scope.drawings)].slice(-50)
          return {
            ...withScope(s, s.scopeKey, () => ({ drawings: [], past, future: [] })),
            selectedId: null,
            draft: null,
            transient: { draft: null, move: null },
            revision: s.revision + 1,
          }
        }),

      setPrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch }, revision: s.revision + 1 })),

      toggleFavorite: (toolId) =>
        set((s) => ({
          favoriteToolIds: s.favoriteToolIds.includes(toolId)
            ? s.favoriteToolIds.filter((x) => x !== toolId)
            : [...s.favoriteToolIds, toolId],
        })),

      undo: () =>
        set((s) => {
          const scope = s.byScope[s.scopeKey] ?? emptyScope()
          if (!scope.past.length) return s
          const prev = scope.past[scope.past.length - 1]
          const past = scope.past.slice(0, -1)
          const future = [snapshot(scope.drawings), ...scope.future].slice(0, 50)
          return {
            ...withScope(s, s.scopeKey, () => ({ drawings: prev, past, future })),
            selectedId: null,
            revision: s.revision + 1,
          }
        }),

      redo: () =>
        set((s) => {
          const scope = s.byScope[s.scopeKey] ?? emptyScope()
          if (!scope.future.length) return s
          const next = scope.future[0]
          const future = scope.future.slice(1)
          const past = [...scope.past, snapshot(scope.drawings)].slice(-50)
          return {
            ...withScope(s, s.scopeKey, () => ({ drawings: next, past, future })),
            selectedId: null,
            revision: s.revision + 1,
          }
        }),

      bumpRevision: () => set((s) => ({ revision: s.revision + 1 })),

      hydrateScopeDrawings: (scopeKey, drawings) =>
        set((s) => ({
          ...withScope(s, scopeKey, () => ({ drawings, past: [], future: [] })),
          revision: s.revision + 1,
        })),

      toggleDrawingLock: (id) =>
        set((s) => ({
          ...withScope(s, s.scopeKey, (scope) => ({
            ...scope,
            drawings: scope.drawings.map((d) => (d.id === id ? { ...d, locked: !d.locked } : d)),
          })),
          revision: s.revision + 1,
        })),

      toggleDrawingVisible: (id) =>
        set((s) => ({
          ...withScope(s, s.scopeKey, (scope) => ({
            ...scope,
            drawings: scope.drawings.map((d) => (d.id === id ? { ...d, visible: !d.visible } : d)),
          })),
          revision: s.revision + 1,
        })),
    }),
    {
      name: 'yieldscan:drawing-system-v2',
      storage: createDebouncedStorage(450),
      partialize: (s) => ({
        byScope: s.byScope,
        prefs: s.prefs,
        favoriteToolIds: s.favoriteToolIds,
      }),
    },
  ),
)
