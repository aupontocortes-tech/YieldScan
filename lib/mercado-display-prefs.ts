/**
 * Preferências locais do bloco Mercado: moeda de exibição e preços manuais por ativo.
 * Persistência: SQLite (sql.js) no IndexedDB; migração única a partir de localStorage.
 */

import { isYieldscanSqliteOpen, kvGetJson, kvSetJson } from '@/lib/client-db/sqlite-core'
import { withDisplayQuotes, type MercadoCoin, MercadoFiat } from '@/lib/coingecko-market'

export type MercadoDisplayFiat = MercadoFiat

const STORAGE_KEY = 'yieldscan-mercado-display-v1'
const KV_KEY = 'mercado_display_v1'

export type MercadoPriceOverrides = Record<string, Partial<Record<MercadoDisplayFiat, number>>>

/** Por slug CoinGecko (ex. tether): em que moeda mostrar só este ativo. Omisso = usa `displayFiat` global. */
export type MercadoDisplayFiatByCoin = Record<string, MercadoDisplayFiat>

export type MercadoDisplayPrefs = {
  displayFiat: MercadoDisplayFiat
  displayFiatByCoinId: MercadoDisplayFiatByCoin
  priceOverrides: MercadoPriceOverrides
}

export const DEFAULT_MERCADO_DISPLAY_PREFS: MercadoDisplayPrefs = {
  displayFiat: 'usd',
  displayFiatByCoinId: {},
  priceOverrides: {},
}

const DEFAULT_PREFS = DEFAULT_MERCADO_DISPLAY_PREFS

function isDisplayFiat(v: unknown): v is MercadoDisplayFiat {
  return v === 'usd' || v === 'brl' || v === 'eur'
}

function sanitizeOverrides(raw: unknown): MercadoPriceOverrides {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: MercadoPriceOverrides = {}
  for (const [id, per] of Object.entries(raw as Record<string, unknown>)) {
    const slug = String(id).trim().toLowerCase()
    if (!slug) continue
    if (per === null || typeof per !== 'object' || Array.isArray(per)) continue
    const slice: Partial<Record<MercadoDisplayFiat, number>> = {}
    for (const f of ['usd', 'brl', 'eur'] as const) {
      const n = (per as Record<string, unknown>)[f]
      if (typeof n === 'number' && Number.isFinite(n) && n >= 0) slice[f] = n
    }
    if (Object.keys(slice).length > 0) out[slug] = slice
  }
  return out
}

function sanitizeFiatByCoin(raw: unknown): MercadoDisplayFiatByCoin {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: MercadoDisplayFiatByCoin = {}
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const slug = String(id).trim().toLowerCase()
    if (!slug || !isDisplayFiat(v)) continue
    out[slug] = v
  }
  return out
}

export function parseMercadoPrefsRecord(j: Record<string, unknown>): MercadoDisplayPrefs {
  const displayFiat = isDisplayFiat(j.displayFiat) ? j.displayFiat : DEFAULT_PREFS.displayFiat
  return {
    displayFiat,
    displayFiatByCoinId: sanitizeFiatByCoin(j.displayFiatByCoinId),
    priceOverrides: sanitizeOverrides(j.priceOverrides),
  }
}

export function readMercadoDisplayPrefs(): MercadoDisplayPrefs {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_PREFS, priceOverrides: {}, displayFiatByCoinId: {} }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const j = JSON.parse(raw) as Record<string, unknown>
      return parseMercadoPrefsRecord(j)
    }
  } catch {
    /* ignore */
  }
  if (isYieldscanSqliteOpen()) {
    const j = kvGetJson<Record<string, unknown>>(KV_KEY)
    if (j && typeof j === 'object' && !Array.isArray(j)) {
      return parseMercadoPrefsRecord(j)
    }
  }
  return { ...DEFAULT_PREFS, priceOverrides: {}, displayFiatByCoinId: {} }
}

export function writeMercadoDisplayPrefs(prefs: MercadoDisplayPrefs): void {
  if (typeof window === 'undefined') return
  const payload = {
    displayFiat: prefs.displayFiat,
    displayFiatByCoinId: prefs.displayFiatByCoinId,
    priceOverrides: prefs.priceOverrides,
  }

  // Fallback imediato: evita “não fica salvo” se o IndexedDB/SQLite falhar.
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }

  kvSetJson(KV_KEY, payload)
}

export type ResolvedMercadoQuote = {
  price: number | null
  change_24h: number | null
  market_cap: number | null
  priceSource: 'override' | 'api'
}

/** Moeda efectiva para um ativo (mapa por slug ou só global). */
export function effectiveDisplayFiatForCoin(
  coinId: string,
  prefs: MercadoDisplayPrefs
): MercadoDisplayFiat {
  const id = coinId.trim().toLowerCase()
  const mapped = id ? prefs.displayFiatByCoinId[id] : undefined
  if (mapped && isDisplayFiat(mapped)) return mapped
  return prefs.displayFiat
}

function quoteSlice(
  coin: MercadoCoin,
  fiat: MercadoDisplayFiat
): { price: number | null; change_24h: number | null; market_cap: number | null } | null {
  const q = coin.quotes?.[fiat]
  if (q && typeof q.price === 'number' && Number.isFinite(q.price)) {
    return {
      price: q.price,
      change_24h:
        typeof q.change_24h === 'number' && Number.isFinite(q.change_24h) ? q.change_24h : null,
      market_cap:
        typeof q.market_cap === 'number' && Number.isFinite(q.market_cap) ? q.market_cap : null,
    }
  }
  if (fiat === 'usd' && coin.price != null && Number.isFinite(coin.price)) {
    return {
      price: coin.price,
      change_24h: coin.change_24h,
      market_cap: coin.market_cap,
    }
  }
  return null
}

export function resolveMercadoDisplay(
  coin: MercadoCoin,
  fiat: MercadoDisplayFiat,
  overrides: MercadoPriceOverrides
): ResolvedMercadoQuote {
  const enriched = withDisplayQuotes(coin)
  const slug = enriched.id.trim().toLowerCase()
  const overrideVal = slug ? overrides[slug]?.[fiat] : undefined
  const base = quoteSlice(enriched, fiat)

  if (overrideVal != null && Number.isFinite(overrideVal)) {
    return {
      price: overrideVal,
      change_24h: base?.change_24h ?? quoteSlice(enriched, 'usd')?.change_24h ?? null,
      market_cap: base?.market_cap ?? null,
      priceSource: 'override',
    }
  }

  if (base) {
    return { ...base, priceSource: 'api' }
  }

  return { price: null, change_24h: null, market_cap: null, priceSource: 'api' }
}

export function formatMercadoFiatAmount(
  n: number | null,
  fiat: MercadoDisplayFiat,
  locale = 'pt-PT'
): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const currency = fiat === 'brl' ? 'BRL' : fiat === 'eur' ? 'EUR' : 'USD'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: n < 1 && n > 0 ? 6 : n < 100 ? 4 : 2,
  }).format(n)
}

export function formatMercadoCap(
  n: number | null,
  fiat: MercadoDisplayFiat,
  locale = 'pt-PT'
): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const currency = fiat === 'brl' ? 'BRL' : fiat === 'eur' ? 'EUR' : 'USD'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return formatMercadoFiatAmount(n, fiat, locale)
  }
}
