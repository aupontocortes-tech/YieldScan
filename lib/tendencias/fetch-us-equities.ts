/**
 * Cotações de ações americanas — FMP stable API + fallback CoinGecko (xStock).
 */
import { fetchEquitiesFromCoingecko } from '@/lib/tendencias/fetch-equities-coingecko'
import {
  US_AI_TECH_TICKERS,
  equityDisplayName,
  equitySectorTag,
  xstockIdForTicker,
  type UsEquitySectorTag,
} from '@/lib/us-equities'
import type { TendenciasEquityRow } from '@/lib/tendencias/types'

const FMP_STABLE = 'https://financialmodelingprep.com/stable'
const FMP_LEGACY = 'https://financialmodelingprep.com/api/v3'

function fmpKey(): string {
  return process.env.FMP_API_KEY?.trim() ?? ''
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

type FmpStockRaw = Record<string, unknown>

function mapStockRow(raw: FmpStockRaw): TendenciasEquityRow | null {
  const symbol = String(raw.symbol ?? '')
    .toUpperCase()
    .trim()
  if (!symbol || symbol.length > 8) return null
  const price = num(raw.price)
  if (price == null) return null

  const name = equityDisplayName(symbol, String(raw.name ?? ''))
  const sectorTag: UsEquitySectorTag = equitySectorTag(symbol)

  return {
    symbol,
    name,
    price,
    changePct: num(raw.changesPercentage ?? raw.changePercentage ?? raw.changes),
    volume: num(raw.volume),
    marketCap: num(raw.marketCap),
    sectorTag,
    xstockId: xstockIdForTicker(symbol),
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    next: { revalidate: 120 },
    signal: AbortSignal.timeout(18_000),
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return null
  return res.json()
}

async function fetchStableBatch(symbols: string[]): Promise<TendenciasEquityRow[]> {
  const key = fmpKey()
  if (!key || symbols.length === 0) return []

  const list = symbols.slice(0, 40).join(',')
  const urls = [
    `${FMP_STABLE}/batch-quote?symbols=${encodeURIComponent(list)}&apikey=${encodeURIComponent(key)}`,
    `${FMP_LEGACY}/quote/${encodeURIComponent(list)}?apikey=${encodeURIComponent(key)}`,
  ]

  for (const url of urls) {
    try {
      const data = await fetchJson(url)
      if (!Array.isArray(data)) continue
      const rows = data.map(mapStockRow).filter((r): r is TendenciasEquityRow => r != null)
      if (rows.length) return rows
    } catch {
      /* try next */
    }
  }

  const out: TendenciasEquityRow[] = []
  for (const sym of symbols.slice(0, 12)) {
    try {
      const url = `${FMP_STABLE}/quote?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(key)}`
      const data = await fetchJson(url)
      const row = Array.isArray(data) ? data[0] : data
      if (row && typeof row === 'object') {
        const mapped = mapStockRow(row as FmpStockRaw)
        if (mapped) out.push(mapped)
      }
    } catch {
      /* ignore */
    }
  }
  return out
}

async function fetchActives(): Promise<TendenciasEquityRow[]> {
  const key = fmpKey()
  if (!key) return []

  const urls = [
    `${FMP_STABLE}/most-actives?apikey=${encodeURIComponent(key)}`,
    `${FMP_LEGACY}/stock_market/actives?apikey=${encodeURIComponent(key)}`,
  ]

  for (const url of urls) {
    try {
      const data = await fetchJson(url)
      if (!Array.isArray(data)) continue
      const rows = data.map(mapStockRow).filter((r): r is TendenciasEquityRow => r != null)
      if (rows.length) return rows
    } catch {
      /* try next */
    }
  }
  return []
}

function dedupeBySymbol(rows: TendenciasEquityRow[]): TendenciasEquityRow[] {
  const seen = new Set<string>()
  const out: TendenciasEquityRow[] = []
  for (const r of rows) {
    if (seen.has(r.symbol)) continue
    seen.add(r.symbol)
    out.push(r)
  }
  return out
}

function sortByVolume(rows: TendenciasEquityRow[]): TendenciasEquityRow[] {
  return [...rows].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
}

function sortByChange(rows: TendenciasEquityRow[]): TendenciasEquityRow[] {
  return [...rows].sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
}

function buildSnapshot(
  watchlist: TendenciasEquityRow[],
  actives: TendenciasEquityRow[],
  sourceLabel: string,
): UsEquitiesSnapshot {
  const aiWatchlist = sortByChange(
    watchlist.filter((r) => ['ia', 'semis', 'big-tech'].includes(r.sectorTag)),
  ).slice(0, 12)

  const highlights = sortByChange(watchlist).slice(0, 8)
  const topVolume = sortByVolume(dedupeBySymbol([...actives, ...watchlist])).slice(0, 10)

  const leader = highlights[0]
  const volLeader = topVolume[0]

  let summary = `Mercado acionário EUA (${sourceLabel}). `
  if (leader?.changePct != null) {
    summary += `${leader.name} (${leader.symbol}) ${leader.changePct >= 0 ? '+' : ''}${leader.changePct.toFixed(2)}% hoje. `
  }
  if (volLeader?.volume != null) {
    summary += `Maior volume: ${volLeader.symbol}. `
  }
  summary += 'Foco em tecnologia e IA.'

  return { highlights, topVolume, aiWatchlist, summary }
}

export type UsEquitiesSnapshot = {
  highlights: TendenciasEquityRow[]
  topVolume: TendenciasEquityRow[]
  aiWatchlist: TendenciasEquityRow[]
  summary: string
}

export async function fetchUsEquitiesSnapshot(): Promise<UsEquitiesSnapshot | null> {
  const key = fmpKey()

  if (key) {
    const [watchlist, actives] = await Promise.all([
      fetchStableBatch([...US_AI_TECH_TICKERS]),
      fetchActives(),
    ])
    if (watchlist.length > 0) {
      return buildSnapshot(watchlist, actives, 'FMP')
    }
  }

  return fetchEquitiesFromCoingecko()
}
