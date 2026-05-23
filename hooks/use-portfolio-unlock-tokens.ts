'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadPortfolio } from '@/lib/portfolio/storage'
import { COINGECKO_HIGHLIGHT_ALIASES } from '@/lib/mercado-highlight-ids'
import type { UnlockTokenProfile } from '@/services/api/types/unlocks'

function resolveGeckoId(h: { geckoId?: string; symbol: string }): string | null {
  if (h.geckoId?.trim()) return h.geckoId.trim().toLowerCase()
  const sym = h.symbol.trim().toLowerCase()
  return COINGECKO_HIGHLIGHT_ALIASES[sym] ?? (sym.length >= 2 ? sym : null)
}

/** Tokens da carteira interna que existem no catálogo de unlocks. */
export function usePortfolioUnlockMatches(catalog: UnlockTokenProfile[] | undefined) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key?.includes('portfolio')) setTick((t) => t + 1)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return useMemo(() => {
    void tick
    const portfolio = loadPortfolio()
    const byGecko = new Map(catalog?.map((c) => [c.geckoId, c]) ?? [])
    const bySymbol = new Map(catalog?.map((c) => [c.symbol.toUpperCase(), c]) ?? [])

    const out: UnlockTokenProfile[] = []
    const seen = new Set<string>()

    for (const h of portfolio.holdings) {
      const gid = resolveGeckoId(h)
      const match =
        (gid && byGecko.get(gid)) ?? bySymbol.get(h.symbol.trim().toUpperCase())
      if (!match || seen.has(match.geckoId)) continue
      seen.add(match.geckoId)
      out.push(match)
    }

    out.sort((a, b) => {
      if (a.nextUnlockAt == null && b.nextUnlockAt == null) return 0
      if (a.nextUnlockAt == null) return 1
      if (b.nextUnlockAt == null) return -1
      return a.nextUnlockAt - b.nextUnlockAt
    })

    return out
  }, [catalog, tick])
}
