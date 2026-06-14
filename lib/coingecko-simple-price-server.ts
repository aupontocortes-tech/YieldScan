import { fetchCoingecko, isCoingeckoAuthError, isCoingeckoRateLimit } from '@/lib/coingecko-server'

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
/** Cache por slug — reutiliza preços entre pedidos com listas diferentes. */
const simplePriceById = new Map<string, { at: number; entry: SimplePriceEntry }>()
const FRESH_MS = 180_000
const ID_FRESH_MS = 180_000
const STALE_ON_ERROR_MS = 24 * 60 * 60 * 1000
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

function rememberById(data: Record<string, SimplePriceEntry>, at: number): void {
  for (const [id, entry] of Object.entries(data)) {
    if (hasUsd(entry)) simplePriceById.set(id, { at, entry })
  }
}

function mergeFromIdCache(ids: string[], now: number): Record<string, SimplePriceEntry> {
  const out: Record<string, SimplePriceEntry> = {}
  for (const id of ids) {
    const hit = simplePriceById.get(id)
    if (hit && now - hit.at <= ID_FRESH_MS && hasUsd(hit.entry)) {
      out[id] = hit.entry
    }
  }
  return out
}

/**
 * simple/price com cache em memória, cache por id e stale-on-429.
 */
export async function fetchCoingeckoSimplePrices(
  ids: string[],
  opts?: {
    vsCurrencies?: string
    include24hrChange?: boolean
    includeMarketCap?: boolean
    allowStale?: boolean
    /** Slugs que ainda não têm preço — evita pedir à CG o lote completo. */
    onlyIds?: string[]
  },
): Promise<SimplePriceResult> {
  const unique = [...new Set((opts?.onlyIds ?? ids).map((id) => id.trim().toLowerCase()).filter(Boolean))]
  if (!unique.length) return { data: {} }

  const vs = opts?.vsCurrencies ?? 'usd,brl,eur'
  const include24 = opts?.include24hrChange !== false
  const includeCap = opts?.includeMarketCap !== false
  const key = cacheKey(unique, vs, include24, includeCap)
  const now = Date.now()
  const hit = simplePriceCache.get(key)
  const fromIds = mergeFromIdCache(unique, now)

  if (hit && now - hit.at <= FRESH_MS) {
    return { data: { ...fromIds, ...hit.data }, cached: true }
  }

  const needCg = unique.filter((id) => !hasUsd(fromIds[id]))
  if (needCg.length === 0) {
    return { data: fromIds, cached: true }
  }

  const joined = needCg.map((id) => encodeURIComponent(id)).join(',')
  let query = `/simple/price?ids=${joined}&vs_currencies=${encodeURIComponent(vs)}`
  if (include24) query += '&include_24hr_change=true'
  if (includeCap) query += '&include_market_cap=true'

  try {
    const res = await fetchCoingecko(query)
    if (!res.ok) {
      const stalePool = { ...(hit?.data ?? {}), ...fromIds }
      const useStale =
        Object.keys(stalePool).length > 0 &&
        (hit ? now - hit.at <= STALE_ON_ERROR_MS : true) &&
        (isCoingeckoRateLimit(res.status) || isCoingeckoAuthError(res.status))
      if (useStale) {
        return { data: stalePool, stale: true }
      }
      if (Object.keys(fromIds).length > 0) {
        return { data: fromIds, stale: true }
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

    const merged = { ...fromIds, ...(hit?.data ?? {}), ...data }
    simplePriceCache.set(key, { at: now, data: merged })
    rememberById(merged, now)
    trimCache()
    return { data: merged }
  } catch {
    const stalePool = { ...(hit?.data ?? {}), ...fromIds }
    if (opts?.allowStale !== false && Object.keys(stalePool).length > 0) {
      return { data: stalePool, stale: true }
    }
    return { data: hit?.data ?? {}, stale: Boolean(hit) }
  }
}
