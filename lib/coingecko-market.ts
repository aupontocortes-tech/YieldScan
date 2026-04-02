/**
 * CoinGecko API pública (sem chave) — agregação para /api/market.
 * Docs: https://docs.coingecko.com/reference
 */

import { COINGECKO_LOGO_BY_ID, SYMBOL_LOGO_URL } from '@/lib/coingecko-static-logos'
import { DEFAULT_MARKET_HIGHLIGHT_IDS } from '@/lib/mercado-highlight-ids'

export type MercadoCoin = {
  id: string
  name: string
  symbol: string
  price: number | null
  change_24h: number | null
  image: string | null
  market_cap: number | null
  source: 'coingecko'
}

export type MarketApiPayload = {
  /** Ordem = pedido; null = moeda sem preço nesta resposta. */
  highlightCoins: (MercadoCoin | null)[]
  /** Eco dos ids pedidos (para o cliente). */
  highlightIds: string[]
  top10: MercadoCoin[]
  trending: MercadoCoin[]
  cachedAt: string
  partial: boolean
  erro: string | null
  fonte: 'coingecko'
}

const TRENDING_URL = 'https://api.coingecko.com/api/v3/search/trending'
const MARKETS_URL =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1'

const UA = 'yieldscan-market/1 (public coingecko)'

/** Nomes conhecidos para slugs frequentes (resto = título a partir do id). */
const KNOWN_COIN_META: Record<string, { name: string; symbol: string }> = {
  bitcoin: { name: 'Bitcoin', symbol: 'BTC' },
  ethereum: { name: 'Ethereum', symbol: 'ETH' },
  solana: { name: 'Solana', symbol: 'SOL' },
  hyperliquid: { name: 'Hyperliquid', symbol: 'HYPE' },
  tether: { name: 'Tether', symbol: 'USDT' },
  'usd-coin': { name: 'USDC', symbol: 'USDC' },
  ripple: { name: 'XRP', symbol: 'XRP' },
  bnb: { name: 'BNB', symbol: 'BNB' },
  dogecoin: { name: 'Dogecoin', symbol: 'DOGE' },
  cardano: { name: 'Cardano', symbol: 'ADA' },
  chainlink: { name: 'Chainlink', symbol: 'LINK' },
  avalanche: { name: 'Avalanche', symbol: 'AVAX' },
  polkadot: { name: 'Polkadot', symbol: 'DOT' },
  'polygon-ecosystem-token': { name: 'Polygon', symbol: 'POL' },
  litecoin: { name: 'Litecoin', symbol: 'LTC' },
  monero: { name: 'Monero', symbol: 'XMR' },
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

async function fetchJson<T>(url: string, timeoutMs = 12_000): Promise<T | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': UA },
      cache: 'no-store',
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export function normalizeMarketsRow(raw: Record<string, unknown>): MercadoCoin | null {
  const id = String(raw.id ?? '').trim()
  if (!id) return null
  const price =
    typeof raw.current_price === 'number' && Number.isFinite(raw.current_price)
      ? raw.current_price
      : null
  const change =
    typeof raw.price_change_percentage_24h === 'number' &&
    Number.isFinite(raw.price_change_percentage_24h)
      ? raw.price_change_percentage_24h
      : null
  const cap =
    typeof raw.market_cap === 'number' && Number.isFinite(raw.market_cap) ? raw.market_cap : null
  return {
    id,
    name: String(raw.name ?? id),
    symbol: String(raw.symbol ?? '').toUpperCase() || id.toUpperCase(),
    price,
    change_24h: change,
    image:
      typeof raw.image === 'string' && raw.image.trim().length > 0 ? raw.image.trim() : null,
    market_cap: cap,
    source: 'coingecko',
  }
}

type SimplePriceEntry = {
  usd?: number
  usd_24h_change?: number
  usd_market_cap?: number
}

function metaForHighlightId(id: string): { name: string; symbol: string } {
  const k = KNOWN_COIN_META[id]
  if (k) return k
  const name = id
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  const symbol = id
    .replace(/-/g, '')
    .slice(0, 8)
    .toUpperCase()
  return { name: name || id, symbol: symbol || id.toUpperCase().slice(0, 6) }
}

function fromSimpleHighlightById(id: string, raw: SimplePriceEntry): MercadoCoin | null {
  if (typeof raw.usd !== 'number' || !Number.isFinite(raw.usd)) return null
  const m = metaForHighlightId(id)
  const change =
    typeof raw.usd_24h_change === 'number' && Number.isFinite(raw.usd_24h_change)
      ? raw.usd_24h_change
      : null
  const cap =
    typeof raw.usd_market_cap === 'number' && Number.isFinite(raw.usd_market_cap)
      ? raw.usd_market_cap
      : null
  return {
    id,
    name: m.name,
    symbol: m.symbol,
    price: raw.usd,
    change_24h: change,
    image: COINGECKO_LOGO_BY_ID[id] ?? null,
    market_cap: cap,
    source: 'coingecko',
  }
}

function fillHighlightStaticLogo(coin: MercadoCoin | null): MercadoCoin | null {
  if (!coin) return null
  const img = coin.image?.trim()
  if (img) return { ...coin, image: img }
  const byId = COINGECKO_LOGO_BY_ID[coin.id]
  if (byId) return { ...coin, image: byId }
  const bySym = SYMBOL_LOGO_URL[coin.symbol.toUpperCase()]
  if (bySym) return { ...coin, image: bySym }
  return { ...coin, image: null }
}

function mergeSimpleIntoCoin(coin: MercadoCoin, raw: SimplePriceEntry): MercadoCoin {
  let next = coin
  if (coin.price == null && typeof raw.usd === 'number' && Number.isFinite(raw.usd)) {
    next = { ...next, price: raw.usd }
  }
  if (
    coin.change_24h == null &&
    typeof raw.usd_24h_change === 'number' &&
    Number.isFinite(raw.usd_24h_change)
  ) {
    next = { ...next, change_24h: raw.usd_24h_change }
  }
  if (
    coin.market_cap == null &&
    typeof raw.usd_market_cap === 'number' &&
    Number.isFinite(raw.usd_market_cap)
  ) {
    next = { ...next, market_cap: raw.usd_market_cap }
  }
  return next
}

function normalizeTrendingEntry(item: unknown): MercadoCoin | null {
  const r = asRecord(item)
  if (!r) return null
  const id = String(r.id ?? r.coin_id ?? '').trim()
  if (!id) return null

  const nested = asRecord(r.data)
  let price: number | null = null
  let change_24h: number | null = null
  if (nested) {
    if (typeof nested.price === 'number' && Number.isFinite(nested.price)) {
      price = nested.price
    }
    const pct = asRecord(nested.price_change_percentage_24h)
    if (pct && typeof pct.usd === 'number' && Number.isFinite(pct.usd)) {
      change_24h = pct.usd
    }
  }

  return {
    id,
    name: String(r.name ?? id),
    symbol: String(r.symbol ?? '').toUpperCase() || id.toUpperCase(),
    price,
    change_24h,
    image:
      typeof r.thumb === 'string'
        ? r.thumb
        : typeof r.small === 'string'
          ? r.small
          : typeof r.large === 'string'
            ? r.large
            : null,
    market_cap: null,
    source: 'coingecko',
  }
}

function emptyPayload(
  highlightIds: string[],
  erro: string | null,
  partial: boolean
): MarketApiPayload {
  return {
    highlightCoins: highlightIds.map(() => null),
    highlightIds,
    top10: [],
    trending: [],
    cachedAt: new Date().toISOString(),
    partial,
    erro,
    fonte: 'coingecko',
  }
}

function buildSimplePriceUrl(ids: string[]): string {
  const unique = [...new Set(ids)].filter(Boolean)
  const joined = unique.map((id) => encodeURIComponent(id)).join('%2C')
  return `https://api.coingecko.com/api/v3/simple/price?ids=${joined}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
}

/**
 * Agrega os três endpoints públicos; tolera falhas parciais.
 * @param highlightIds até 4 slugs CoinGecko (ex.: bitcoin, ethereum).
 */
export async function agregarMercadoCoinGecko(
  highlightIds: string[] = [...DEFAULT_MARKET_HIGHLIGHT_IDS]
): Promise<MarketApiPayload> {
  const ids = [...new Set(highlightIds.filter(Boolean))].slice(0, 4)
  if (ids.length === 0) {
    return emptyPayload(
      [...DEFAULT_MARKET_HIGHLIGHT_IDS],
      'Lista de destaques inválida.',
      true
    )
  }

  const simpleUrl = buildSimplePriceUrl(ids)

  const [simpleRaw, trendingRaw, marketsRaw] = await Promise.all([
    fetchJson<Record<string, SimplePriceEntry>>(simpleUrl),
    fetchJson<{ coins?: unknown[] }>(TRENDING_URL),
    fetchJson<unknown[]>(MARKETS_URL),
  ])

  let partial = false
  const erros: string[] = []

  const top10: MercadoCoin[] = []
  if (Array.isArray(marketsRaw)) {
    for (const row of marketsRaw.slice(0, 10)) {
      const r = asRecord(row)
      if (!r) continue
      const c = normalizeMarketsRow(r)
      if (c) top10.push(c)
    }
  }
  if (top10.length === 0) {
    partial = true
    erros.push('Lista top 10 indisponível.')
  }

  const pick = (id: string) => top10.find((c) => c.id === id) ?? null

  const highlightCoins: (MercadoCoin | null)[] = ids.map((id) => {
    let coin: MercadoCoin | null = pick(id)

    const s = simpleRaw?.[id]
    if (s && typeof s === 'object') {
      const entry = s as SimplePriceEntry
      if (!coin) {
        coin = fromSimpleHighlightById(id, entry)
      } else {
        coin = mergeSimpleIntoCoin(coin, entry)
      }
    }

    if (!coin || coin.price == null) {
      partial = true
      erros.push(`Preço ${id} indisponível.`)
    }

    return fillHighlightStaticLogo(coin)
  })

  const trending: MercadoCoin[] = []
  const coins = trendingRaw?.coins
  if (Array.isArray(coins)) {
    for (const entry of coins) {
      const wrap = asRecord(entry)
      const item = wrap ? wrap.item : entry
      const c = normalizeTrendingEntry(item)
      if (c) trending.push(c)
    }
  }
  if (trending.length === 0) {
    partial = true
    erros.push('Trending indisponível.')
  }

  const anyHighlight = highlightCoins.some((c) => c != null && c.price != null)
  const semDados =
    top10.length === 0 && !anyHighlight && trending.length === 0

  return {
    highlightCoins,
    highlightIds: ids,
    top10,
    trending,
    cachedAt: new Date().toISOString(),
    partial: partial || semDados,
    erro: semDados
      ? 'CoinGecko temporariamente indisponível. Tenta dentro de instantes.'
      : erros.length > 0
        ? erros.join(' ')
        : null,
    fonte: 'coingecko',
  }
}
