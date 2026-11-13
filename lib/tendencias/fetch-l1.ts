export type RawLlamaChain = {
  name: string
  tvl: number
  geckoId: string | null
  tokenSymbol: string | null
  tvlPrevDay: number | null
  tvlPrevWeek: number | null
}

export type RawLlamaProtocol = {
  name: string
  symbol: string | null
  slug: string | null
  geckoId: string | null
  category: string
  chains: string[]
  chainTvls: Record<string, number>
  tvl: number
  change7d: number | null
  mcap: number | null
  description: string | null
  url: string | null
}

export type DexVolumeByChain = Record<string, number>

type LlamaChainJson = {
  name?: string
  tvl?: number
  gecko_id?: string | null
  tokenSymbol?: string | null
  tvlPrevDay?: number
  tvlPrevWeek?: number
}

type LlamaProtocolJson = {
  name?: string
  symbol?: string | null
  slug?: string | null
  gecko_id?: string | null
  category?: string
  chains?: string[]
  chainTvls?: Record<string, number | { tvl?: number }>
  tvl?: number
  change_7d?: number | null
  mcap?: number | null
  description?: string | null
  url?: string | null
  twitter?: string | null
}

type DexOverviewJson = {
  protocols?: Array<{
    name?: string
    total24h?: number
    breakdown24h?: Record<string, number | Record<string, number>> | null
    chains?: string[]
  }>
}

const LLAMA = 'https://api.llama.fi'

async function llamaJson<T>(path: string, timeoutMs: number, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${LLAMA}${path}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function fetchLlamaChainsDetailed(limit = 40): Promise<RawLlamaChain[]> {
  const rows = await llamaJson<LlamaChainJson[]>('/chains', 14_000, 300)
  if (!Array.isArray(rows)) return []
  const mapped = rows
    .filter((c) => c.name && typeof c.tvl === 'number' && c.tvl > 0)
    .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
    .slice(0, limit)
    .map((c) => ({
      name: c.name!,
      tvl: c.tvl ?? 0,
      geckoId: c.gecko_id ?? null,
      tokenSymbol: c.tokenSymbol ? String(c.tokenSymbol).toUpperCase() : null,
      tvlPrevDay: typeof c.tvlPrevDay === 'number' ? c.tvlPrevDay : null,
      tvlPrevWeek: typeof c.tvlPrevWeek === 'number' ? c.tvlPrevWeek : null,
    }))
  return attachWeekChange(mapped)
}

function clipText(s: string | null | undefined, max = 520): string | null {
  if (!s) return null
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length > max ? `${t.slice(0, max).trim()}…` : t
}

function normalizeChainTvls(raw: LlamaProtocolJson['chainTvls']): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw) return out
  for (const [chain, val] of Object.entries(raw)) {
    if (chain.includes('-') && /borrowed|staking|pool2|doublecounted|offers|vesting/i.test(chain)) continue
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      out[chain] = val
    } else if (val && typeof val === 'object' && typeof val.tvl === 'number' && val.tvl > 0) {
      out[chain] = val.tvl
    }
  }
  return out
}

function isCexProtocol(p: LlamaProtocolJson): boolean {
  const cat = String(p.category ?? '').toLowerCase()
  const name = String(p.name ?? '')
  if (cat.includes('cex')) return true
  return /binance cex|\bokx\b|bybit|coinbase|kraken|bitfinex|kucoin|gate\.io|crypto\.com|mexc|bitget/i.test(name)
}

export async function fetchLlamaProtocolsLite(limit = 220): Promise<RawLlamaProtocol[]> {
  const rows = await llamaJson<LlamaProtocolJson[]>('/protocols', 18_000, 300)
  if (!Array.isArray(rows)) return []
  return rows
    .filter((p) => p.name && typeof p.tvl === 'number' && p.tvl > 250_000 && !isCexProtocol(p))
    .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
    .slice(0, limit)
    .map((p) => {
      const symbol = p.symbol ? String(p.symbol).toUpperCase() : null
      return {
        name: p.name!,
        symbol: symbol && symbol !== '-' ? symbol : null,
        slug: p.slug ?? null,
        geckoId: p.gecko_id ?? null,
        category: p.category ?? 'DeFi',
        chains: Array.isArray(p.chains) ? p.chains.filter((c) => typeof c === 'string') : [],
        chainTvls: normalizeChainTvls(p.chainTvls),
        tvl: p.tvl ?? 0,
        change7d: typeof p.change_7d === 'number' ? p.change_7d : null,
        mcap: typeof p.mcap === 'number' ? p.mcap : null,
        description: clipText(p.description),
        url: p.url ?? null,
      }
    })
}

async function attachWeekChange(chains: RawLlamaChain[]): Promise<RawLlamaChain[]> {
  const top = chains.slice(0, 14)
  const rest = chains.slice(14)
  const updated = await Promise.all(
    top.map(async (c) => {
      if (c.tvlPrevWeek != null) return c
      const pts = await llamaJson<Array<{ date: number; tvl: number }>>(
        `/v2/historicalChainTvl/${encodeURIComponent(c.name)}`,
        7_000,
        600,
      )
      if (!Array.isArray(pts) || pts.length < 8) return c
      const weekAgo = pts[pts.length - 8]?.tvl
      return {
        ...c,
        tvlPrevWeek: typeof weekAgo === 'number' && weekAgo > 0 ? weekAgo : c.tvlPrevWeek,
      }
    }),
  )
  return [...updated, ...rest]
}

function flattenBreakdown(raw: Record<string, number | Record<string, number>> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw) return out
  for (const [chain, val] of Object.entries(raw)) {
    if (typeof val === 'number' && Number.isFinite(val)) {
      out[chain] = (out[chain] ?? 0) + val
    } else if (val && typeof val === 'object') {
      for (const inner of Object.values(val)) {
        if (typeof inner === 'number' && Number.isFinite(inner)) {
          out[chain] = (out[chain] ?? 0) + inner
        }
      }
    }
  }
  return out
}

export async function fetchDexVolumeByChain(): Promise<DexVolumeByChain> {
  const data = await llamaJson<DexOverviewJson>(
    '/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true',
    14_000,
    300,
  )
  if (!data) return {}

  const byChain: DexVolumeByChain = {}
  for (const p of data.protocols ?? []) {
    const parts = flattenBreakdown(p.breakdown24h ?? null)
    if (Object.keys(parts).length > 0) {
      for (const [chain, vol] of Object.entries(parts)) {
        byChain[chain] = (byChain[chain] ?? 0) + vol
      }
    } else if (typeof p.total24h === 'number' && p.chains?.length === 1 && p.chains[0]) {
      byChain[p.chains[0]] = (byChain[p.chains[0]] ?? 0) + p.total24h
    }
  }

  return byChain
}
