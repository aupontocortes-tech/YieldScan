export type RawChainTvl = { name: string; tvl: number }

export type RawGlobalTvlPoint = { date: number; totalLiquidityUSD: number }

export type RawYieldPool = {
  project?: string
  chain?: string
  symbol?: string
  tvlUsd?: number
  apy?: number
}

export type RawProtocolFees = {
  name: string
  slug: string
  gecko_id: string | null
  symbol: string | null
  fees24h: number | null
  revenue24h: number | null
  total7d: number | null
  change_1d: number | null
}

type FeesOverviewProtocol = {
  name?: string
  slug?: string
  defillamaId?: string
  gecko_id?: string | null
  symbol?: string
  total24h?: number
  total7d?: number
  change_1d?: number
}

export async function fetchTopProtocolFees(limit = 40): Promise<RawProtocolFees[]> {
  try {
    const url =
      'https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyRevenue'
    const res = await fetch(url, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(18_000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { protocols?: FeesOverviewProtocol[] }
    const rows = data.protocols ?? []
    return rows
      .filter((p) => p.name)
      .sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
      .slice(0, limit)
      .map((p) => ({
        name: p.name!,
        slug: p.slug ?? p.defillamaId ?? p.name!.toLowerCase().replace(/\s+/g, '-'),
        gecko_id: p.gecko_id ?? null,
        symbol: p.symbol?.toUpperCase() ?? null,
        fees24h: p.total24h ?? null,
        revenue24h: p.total24h ?? null,
        total7d: p.total7d ?? null,
        change_1d: p.change_1d ?? null,
      }))
  } catch {
    return []
  }
}

export function indexProtocolFees(rows: RawProtocolFees[]): {
  byGecko: Map<string, RawProtocolFees>
  bySymbol: Map<string, RawProtocolFees>
} {
  const byGecko = new Map<string, RawProtocolFees>()
  const bySymbol = new Map<string, RawProtocolFees>()
  for (const r of rows) {
    if (r.gecko_id) byGecko.set(r.gecko_id, r)
    if (r.symbol) bySymbol.set(r.symbol, r)
  }
  return { byGecko, bySymbol }
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
