'use client'

import { create } from 'zustand'
import type { UnlocksPeriod } from '@/services/api/types/unlocks'

export type UnlocksView = 'next' | 'largest' | 'wallet'

type UnlocksStore = {
  period: UnlocksPeriod
  view: UnlocksView
  selectedGeckoId: string | null
  extraGeckoIds: string[]
  search: string
  setPeriod: (period: UnlocksPeriod) => void
  setView: (view: UnlocksView) => void
  setSelectedGeckoId: (id: string | null) => void
  addExtraGeckoId: (id: string) => void
  setSearch: (q: string) => void
}

export const useUnlocksStore = create<UnlocksStore>((set, get) => ({
  period: '7d',
  view: 'next',
  selectedGeckoId: null,
  extraGeckoIds: [],
  search: '',
  setPeriod: (period) => set({ period }),
  setView: (view) => set({ view }),
  setSelectedGeckoId: (selectedGeckoId) => set({ selectedGeckoId }),
  addExtraGeckoId: (id) => {
    const trimmed = id.trim().toLowerCase()
    if (!trimmed) return
    const prev = get().extraGeckoIds
    if (prev.includes(trimmed)) return
    set({ extraGeckoIds: [...prev, trimmed].slice(-25), selectedGeckoId: trimmed })
  },
  setSearch: (search) => set({ search }),
}))
