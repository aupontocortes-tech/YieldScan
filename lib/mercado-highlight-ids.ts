/**
 * IDs CoinGecko (slug) para os cartões grandes do mercado.
 * Preferências no SQLite local (IndexedDB); migração a partir de localStorage.
 */

import { isYieldscanSqliteOpen, kvDelete, kvGetJson, kvSetJson } from '@/lib/client-db/sqlite-core'
import { afterMercadoLocalWrite, pickNewerBySavedAt } from '@/lib/mercado-persist'
import { scheduleNeonPush } from '@/lib/neon/sync-schedule'
import { MERCADO_HIGHLIGHT_EXTRA_ALIASES } from '@/lib/mercado-highlight-presets'
import { DEFAULT_MARKET_HIGHLIGHT_MIX } from '@/lib/us-equities'

export const DEFAULT_MARKET_HIGHLIGHT_IDS = [...DEFAULT_MARKET_HIGHLIGHT_MIX] as const

/** Máximo de moedas em destaque (URL + CoinGecko simple/price). */
export const MAX_MARKET_HIGHLIGHTS = 60

const STORAGE_KEY = 'yieldscan-mercado-highlight-ids'
const KV_KEY = 'mercado_highlights_v1'

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/

/**
 * Ticker ou slug errado → id oficial CoinGecko (simple/price só aceita o slug da API).
 * Ex.: usdt → tether, bnb → binancecoin.
 */
export const COINGECKO_HIGHLIGHT_ALIASES: Record<string, string> = {
  sdt: 'tether',
  usdt: 'tether',
  'usd-t': 'tether',
  usdc: 'usd-coin',
  'usd-c': 'usd-coin',
  btc: 'bitcoin',
  xbt: 'bitcoin',
  eth: 'ethereum',
  sol: 'solana',
  bnb: 'binancecoin',
  xrp: 'ripple',
  doge: 'dogecoin',
  link: 'chainlink',
  avax: 'avalanche',
  dot: 'polkadot',
  matic: 'polygon-ecosystem-token',
  'matic-network': 'polygon-ecosystem-token',
  pol: 'polygon-ecosystem-token',
  ada: 'cardano',
  ltc: 'litecoin',
  bch: 'bitcoin-cash',
  trx: 'tron',
  shib: 'shiba-inu',
  uni: 'uniswap',
  atom: 'cosmos',
  etc: 'ethereum-classic',
  xlm: 'stellar',
  near: 'near',
  apt: 'aptos',
  sui: 'sui',
  arb: 'arbitrum',
  op: 'optimism',
  hype: 'hyperliquid',
  hyperliquidx: 'hyperliquid',
  pendle: 'pendle',
  aave: 'aave',
  purr: 'purr-2',
  'purr-2': 'purr-2',
  wbtc: 'wrapped-bitcoin',
  weth: 'weth',
  steth: 'staked-ether',
  dai: 'dai',
  ...MERCADO_HIGHLIGHT_EXTRA_ALIASES,
}

export function canonicalHighlightCoinGeckoId(raw: string): string {
  const t = String(raw).trim().toLowerCase()
  if (!t) return ''
  return COINGECKO_HIGHLIGHT_ALIASES[t] ?? t
}

export function sanitizeHighlightIds(raw: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of raw) {
    const id = canonicalHighlightCoinGeckoId(String(s))
    if (!id || !ID_RE.test(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= MAX_MARKET_HIGHLIGHTS) break
  }
  return out.length > 0 ? out : [...DEFAULT_MARKET_HIGHLIGHT_IDS]
}

/** Query ?highlights=bitcoin,ethereum,... */
export function parseHighlightsQueryParam(param: string | null): string[] {
  if (!param?.trim()) return [...DEFAULT_MARKET_HIGHLIGHT_IDS]
  const parts = param
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
  return sanitizeHighlightIds(parts)
}

type StoredHighlightIds = { ids: string[]; savedAt?: number }

function readHighlightIdsFromRaw(raw: string): { ids: string[]; savedAt: number } | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return { ids: sanitizeHighlightIds(parsed.map(String)), savedAt: 0 }
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as StoredHighlightIds).ids)) {
      const row = parsed as StoredHighlightIds
      const savedAt = typeof row.savedAt === 'number' && Number.isFinite(row.savedAt) ? row.savedAt : 0
      return { ids: sanitizeHighlightIds(row.ids.map(String)), savedAt }
    }
  } catch {
    /* ignore */
  }
  return null
}

function readHighlightIdsFromSqlite(): { ids: string[]; savedAt: number } | null {
  if (!isYieldscanSqliteOpen()) return null
  const parsed = kvGetJson<unknown>(KV_KEY)
  if (Array.isArray(parsed)) {
    return { ids: sanitizeHighlightIds(parsed.map(String)), savedAt: 0 }
  }
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as StoredHighlightIds).ids)) {
    const row = parsed as StoredHighlightIds
    const savedAt = typeof row.savedAt === 'number' && Number.isFinite(row.savedAt) ? row.savedAt : 0
    return { ids: sanitizeHighlightIds(row.ids.map(String)), savedAt }
  }
  return null
}

export function readStoredHighlightIds(): string[] | null {
  if (typeof window === 'undefined') return null

  let fromLs: { ids: string[]; savedAt: number } | null = null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) fromLs = readHighlightIdsFromRaw(raw)
  } catch {
    /* ignore */
  }

  const fromSql = readHighlightIdsFromSqlite()
  const picked = pickNewerBySavedAt(
    fromSql ? { value: fromSql.ids, savedAt: fromSql.savedAt } : null,
    fromLs ? { value: fromLs.ids, savedAt: fromLs.savedAt } : null,
  )
  return picked
}

export function writeStoredHighlightIds(ids: string[], opts?: { skipNeon?: boolean }): void {
  const next = sanitizeHighlightIds(ids)
  const payload: StoredHighlightIds = { ids: next, savedAt: Date.now() }
  // Fallback imediato: se por algum motivo o SQLite/IDB não estiver disponível,
  // pelo menos a UI continua persistindo no localStorage.
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      /* ignore */
    }
  }

  kvSetJson(KV_KEY, payload)
  if (!opts?.skipNeon) {
    afterMercadoLocalWrite()
    scheduleNeonPush('mercado', 800)
  }
}

export function clearStoredHighlightIds(): void {
  kvDelete(KV_KEY)
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
