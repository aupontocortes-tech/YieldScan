export type RawChainTvl = { name: string; tvl: number }

export type RawGlobalTvlPoint = { date: number; tvl: number | Record<string, number> }

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

export type RawHoldersBuyback = {
  name: string
  slug: string
  geckoId: string | null
  symbol: string | null
  revenue24h: number
  revenue7d: number
  change1d: number | null
  change7d: number | null
}

export type HoldersBuybackOverview = {
  total24h: number
  total7d: number
  change1d: number | null
  change7d: number | null
  protocols: RawHoldersBuyback[]
}

const HOLDERS_GECKO_SYMBOL: Record<string, string> = {
  hyperliquid: 'HYPE',
  uniswap: 'UNI',
  sky: 'SKY',
  maker: 'MKR',
  'aerodrome-finance': 'AERO',
  gmx: 'GMX',
  'pump-fun': 'PUMP',
  binancecoin: 'BNB',
  'curve-dao-token': 'CRV',
  tron: 'TRX',
  ethereum: 'ETH',
  chainlink: 'LINK',
  'pancakeswap-token': 'CAKE',
}

const HOLDERS_SLUG_GECKO: Record<string, string> = {
  'hyperliquid-perps': 'hyperliquid',
  'hyperliquid-spot-orderbook': 'hyperliquid',
  tron: 'tron',
  ethereum: 'ethereum',
  'uniswap-v3': 'uniswap',
  uniswap: 'uniswap',
  'sky-lending': 'sky',
  sky: 'sky',
  'curve-dex': 'curve-dao-token',
  'aero-slipstream': 'aerodrome-finance',
  aerodrome: 'aerodrome-finance',
  'gmx-solana': 'gmx',
  gmx: 'gmx',
  'pump.fun': 'pump-fun',
  'chainlink-staking': 'chainlink',
  'lighter-perps': 'lighter',
  'binance-cex': 'binancecoin',
  makerdao: 'maker',
  'makerdao-legacy': 'maker',
  pancake: 'pancakeswap-token',
  'pancakeswap-amm': 'pancakeswap-token',
}

export async function fetchHoldersBuybacks(limit = 25): Promise<HoldersBuybackOverview> {
  const empty: HoldersBuybackOverview = { total24h: 0, total7d: 0, change1d: null, change7d: null, protocols: [] }
  try {
    const url =
      'https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyHoldersRevenue'
    const res = await fetch(url, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(18_000),
    })
    if (!res.ok) return empty
    const data = (await res.json()) as {
      total24h?: number
      total7d?: number
      change_1d?: number
      change_7d?: number
      protocols?: Array<{
        name?: string
        slug?: string
        gecko_id?: string | null
        symbol?: string | null
        total24h?: number
        total7d?: number
        change_1d?: number
        change_7d?: number
      }>
    }
    const protocols = (data.protocols ?? [])
      .filter((p) => (p.total24h ?? 0) > 50_000)
      .sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
      .slice(0, limit)
      .map((p) => {
        const slug = p.slug ?? p.name?.toLowerCase().replace(/\s+/g, '-') ?? ''
        const geckoId = p.gecko_id ?? HOLDERS_SLUG_GECKO[slug] ?? null
        return {
          name: p.name ?? slug,
          slug,
          geckoId,
          symbol: p.symbol
            ? String(p.symbol).toUpperCase()
            : geckoId && HOLDERS_GECKO_SYMBOL[geckoId]
              ? HOLDERS_GECKO_SYMBOL[geckoId]
              : null,
          revenue24h: p.total24h ?? 0,
          revenue7d: p.total7d ?? 0,
          change1d: typeof p.change_1d === 'number' ? p.change_1d : null,
          change7d: typeof p.change_7d === 'number' ? p.change_7d : null,
        }
      })
    return {
      total24h: data.total24h ?? protocols.reduce((s, p) => s + p.revenue24h, 0),
      total7d: data.total7d ?? protocols.reduce((s, p) => s + p.revenue7d, 0),
      change1d: typeof data.change_1d === 'number' ? data.change_1d : null,
      change7d: typeof data.change_7d === 'number' ? data.change_7d : null,
      protocols,
    }
  } catch {
    return empty
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

/** Valor TVL num ponto histórico (número agregado ou mapa por chain). */
export function tvlFromHistoricalPoint(point: RawGlobalTvlPoint | undefined): number | null {
  if (!point) return null
  const raw = point.tvl
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (raw && typeof raw === 'object') {
    const sum = Object.values(raw).reduce(
      (acc, v) => acc + (typeof v === 'number' && Number.isFinite(v) ? v : 0),
      0,
    )
    return sum > 0 ? sum : null
  }
  return null
}

export function enrichTvlGlobalFromChains(
  tvlGlobal: { current: number | null; changePct: number | null },
  chains: RawChainTvl[],
): { current: number | null; changePct: number | null } {
  if (tvlGlobal.current != null) return tvlGlobal
  const sum = chains.reduce((acc, c) => acc + (Number.isFinite(c.tvl) ? c.tvl : 0), 0)
  if (sum <= 0) return tvlGlobal
  return { current: sum, changePct: tvlGlobal.changePct }
}

export async function fetchGlobalTvlChange7d(): Promise<{
  current: number | null
  changePct: number | null
}> {
  try {
    const res = await fetch('https://api.llama.fi/v2/historicalChainTvl', {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(14_000),
    })
    if (!res.ok) return { current: null, changePct: null }
    const points = (await res.json()) as RawGlobalTvlPoint[]
    if (points.length < 8) return { current: null, changePct: null }
    const current = tvlFromHistoricalPoint(points[points.length - 1])
    const weekAgo = tvlFromHistoricalPoint(points[Math.max(0, points.length - 8)])
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
