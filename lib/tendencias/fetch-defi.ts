export type RawChainTvl = { name: string; tvl: number }

export type RawGlobalTvlPoint = { date: number; totalLiquidityUSD: number }

export type RawYieldPool = {
  project?: string
  chain?: string
  symbol?: string
  tvlUsd?: number
  apy?: number
}

export async function fetchDefiChainsTop(limit = 8): Promise<RawChainTvl[]> {
  try {
    const res = await fetch('https://api.llama.fi/v2/chains', {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(14_000),
    })
    if (!res.ok) return []
    const rows = (await res.json()) as RawChainTvl[]
    return [...rows].sort((a, b) => b.tvl - a.tvl).slice(0, limit)
  } catch {
    return []
  }
}

export async function fetchGlobalTvlChange7d(): Promise<{
  current: number | null
  changePct: number | null
}> {
  try {
    const res = await fetch('https://api.llama.fi/v2/historical/global', {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(14_000),
    })
    if (!res.ok) return { current: null, changePct: null }
    const points = (await res.json()) as RawGlobalTvlPoint[]
    if (points.length < 8) return { current: null, changePct: null }
    const current = points[points.length - 1]?.totalLiquidityUSD ?? null
    const weekAgo = points[Math.max(0, points.length - 8)]?.totalLiquidityUSD ?? null
    if (current == null || weekAgo == null || weekAgo <= 0) {
      return { current, changePct: null }
    }
    return { current, changePct: ((current - weekAgo) / weekAgo) * 100 }
  } catch {
    return { current: null, changePct: null }
  }
}

export async function fetchTopYieldPools(limit = 6): Promise<RawYieldPool[]> {
  try {
    const res = await fetch('https://yields.llama.fi/pools', {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { data?: RawYieldPool[] }
    const pools = data.data ?? []
    const seen = new Set<string>()
    const out: RawYieldPool[] = []
    for (const p of [...pools].sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))) {
      const key = `${p.project}-${p.chain}`
      if (!p.project || seen.has(key)) continue
      seen.add(key)
      out.push(p)
      if (out.length >= limit) break
    }
    return out
  } catch {
    return []
  }
}
