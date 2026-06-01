/**
 * Cotações de ações americanas via Financial Modeling Prep (FMP_API_KEY).
 */
import {
  US_AI_TECH_TICKERS,
  equityDisplayName,
  equitySectorTag,
  xstockIdForTicker,
  type UsEquitySectorTag,
} from '@/lib/us-equities'
import type { TendenciasEquityRow } from '@/lib/tendencias/types'

const FMP_BASE = 'https://financialmodelingprep.com/api/v3'

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

async function fetchQuotesBatch(symbols: string[]): Promise<TendenciasEquityRow[]> {
  const key = fmpKey()
  if (!key || symbols.length === 0) return []

  const chunk = symbols.slice(0, 40).join(',')
  try {
    const url = `${FMP_BASE}/quote/${encodeURIComponent(chunk)}?apikey=${encodeURIComponent(key)}`
    const res = await fetch(url, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(18_000),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    const rows = (await res.json()) as FmpStockRaw[]
    if (!Array.isArray(rows)) return []
    return rows.map(mapStockRow).filter((r): r is TendenciasEquityRow => r != null)
  } catch {
    return []
  }
}

async function fetchActives(): Promise<TendenciasEquityRow[]> {
  const key = fmpKey()
  if (!key) return []
  try {
    const url = `${FMP_BASE}/stock_market/actives?apikey=${encodeURIComponent(key)}`
    const res = await fetch(url, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(18_000),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    const rows = (await res.json()) as FmpStockRaw[]
    if (!Array.isArray(rows)) return []
    return rows.map(mapStockRow).filter((r): r is TendenciasEquityRow => r != null)
  } catch {
    return []
  }
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

export type UsEquitiesSnapshot = {
  highlights: TendenciasEquityRow[]
  topVolume: TendenciasEquityRow[]
  aiWatchlist: TendenciasEquityRow[]
  summary: string
}

export async function fetchUsEquitiesSnapshot(): Promise<UsEquitiesSnapshot | null> {
  const key = fmpKey()
  if (!key) return null

  const [watchlist, actives] = await Promise.all([
    fetchQuotesBatch([...US_AI_TECH_TICKERS]),
    fetchActives(),
  ])

  const aiWatchlist = sortByChange(
    watchlist.filter((r) => ['ia', 'semis', 'big-tech'].includes(r.sectorTag)),
  ).slice(0, 12)

  const highlights = sortByChange(watchlist).slice(0, 8)

  const topVolume = sortByVolume(dedupeBySymbol([...actives, ...watchlist])).slice(0, 10)

  const leader = highlights[0]
  const volLeader = topVolume[0]

  let summary = 'Mercado acionário EUA (dados FMP). '
  if (leader?.changePct != null) {
    summary += `${leader.name} (${leader.symbol}) ${leader.changePct >= 0 ? '+' : ''}${leader.changePct.toFixed(2)}% hoje. `
  }
  if (volLeader?.volume != null) {
    summary += `Maior volume entre as ações monitorizadas: ${volLeader.symbol}. `
  }
  summary += 'Destaques focados em tecnologia e IA.'

  return {
    highlights,
    topVolume,
    aiWatchlist,
    summary,
  }
}
