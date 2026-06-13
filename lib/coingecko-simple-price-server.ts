import { getCoingeckoRequestParts } from '@/lib/coingecko-server'

export type SimplePriceEntry = {
  usd?: number
  brl?: number
  eur?: number
  usd_24h_change?: number
  brl_24h_change?: number
  eur_24h_change?: number
  usd_market_cap?: number
  brl_market_cap?: number
  eur_market_cap?: number
}

type CacheRow = { at: number; data: Record<string, SimplePriceEntry> }

const simplePriceCache = new Map<string, CacheRow>()
const FRESH_MS = 90_000
const STALE_ON_429_MS = 6 * 60 * 60 * 1000
const MAX_KEYS = 120

function cacheKey(ids: string[], vs: string, include24: boolean, includeCap: boolean): string {
  return `${[...ids].sort().join(',')}|${vs}|${include24 ? 1 : 0}|${includeCap ? 1 : 0}`
}

function trimCache() {
  if (simplePriceCache.size <= MAX_KEYS) return
  const sorted = [...simplePriceCache.entries()].sort((a, b) => a[1].at - b[1].at)
  const remove = sorted.length - Math.floor(MAX_KEYS * 0.75)
  for (let i = 0; i < remove; i++) simplePriceCache.delete(sorted[i]![0])
}

function hasUsd(entry: SimplePriceEntry | undefined): boolean {
  return typeof entry?.usd === 'number' && Number.isFinite(entry.usd)
}

export type SimplePriceResult = {
  data: Record<string, SimplePriceEntry>
  cached?: boolean
  stale?: boolean
}

/**
 * simple/price com cache em memória e stale-on-429 (partilhado por /api/market e proxy).
 */
export async function fetchCoingeckoSimplePrices(
  ids: string[],
  opts?: {
    vsCurrencies?: string
    include24hrChange?: boolean
    includeMarketCap?: boolean
    allowStale?: boolean
  },
): Promise<SimplePriceResult> {
  const unique = [...new Set(ids.map((id) => id.trim().toLowerCase()).filter(Boolean))]
  if (!unique.length) return { data: {} }

  const vs = opts?.vsCurrencies ?? 'usd,brl,eur'
  const include24 = opts?.include24hrChange !== false
  const includeCap = opts?.includeMarketCap !== false
  const key = cacheKey(unique, vs, include24, includeCap)
  const now = Date.now()
  const hit = simplePriceCache.get(key)

  if (hit && now - hit.at <= FRESH_MS) {
    return { data: hit.data, cached: true }
  }

  const { base, headers } = getCoingeckoRequestParts()
  const joined = unique.map((id) => encodeURIComponent(id)).join(',')
  let url = `${base}/simple/price?ids=${joined}&vs_currencies=${encodeURIComponent(vs)}`
  if (include24) url += '&include_24hr_change=true'
  if (includeCap) url += '&include_market_cap=true'

  try {
    const res = await fetch(url, { headers, cache: 'no-store' })
    if (!res.ok) {
      if (res.status === 429 && hit && now - hit.at <= STALE_ON_429_MS) {
        return { data: hit.data, stale: true }
      }
      return { data: hit?.data ?? {}, stale: Boolean(hit) }
    }

    const raw = (await res.json()) as Record<string, SimplePriceEntry>
    const data: Record<string, SimplePriceEntry> = {}
    if (raw && typeof raw === 'object') {
      for (const [id, entry] of Object.entries(raw)) {
        if (entry && typeof entry === 'object' && hasUsd(entry)) data[id] = entry
      }
    }

    const merged = { ...(hit?.data ?? {}), ...data }
    simplePriceCache.set(key, { at: now, data: merged })
    trimCache()
    return { data: merged }
  } catch {
    if (hit && (opts?.allowStale !== false) && now - hit.at <= STALE_ON_429_MS) {
      return { data: hit.data, stale: true }
    }
    return { data: hit?.data ?? {}, stale: Boolean(hit) }
  }
}
