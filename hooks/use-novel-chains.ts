'use client'

import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'yieldscan_seen_chains_v1'

/** Redes vistas em visitas anteriores; ao sair da página, mescla as atuais no storage. */
export function useNovelChains(sortedChainIds: string[]) {
  const [novelChains, setNovelChains] = useState<Set<string>>(new Set())
  const chainKey = useMemo(() => sortedChainIds.join('|'), [sortedChainIds])

  useEffect(() => {
    if (sortedChainIds.length === 0) return
    const unique = [...new Set(sortedChainIds)]

    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (!raw) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(unique))
      }
      setNovelChains(new Set())
      return
    }

    const known = new Set(JSON.parse(raw) as string[])
    setNovelChains(new Set(unique.filter((c) => !known.has(c))))

    return () => {
      const merged = [...new Set([...known, ...unique])]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    }
  }, [chainKey, sortedChainIds])

  return novelChains
}
