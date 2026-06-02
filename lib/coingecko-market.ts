/**
 * CoinGecko API pública (sem chave) — agregação para /api/market.
 * Docs: https://docs.coingecko.com/reference
 */

import { getCoingeckoRequestParts } from '@/lib/coingecko-server'
import { COINGECKO_LOGO_BY_ID, SYMBOL_LOGO_URL } from '@/lib/coingecko-static-logos'
import { highlightMetaFromPresetOrId } from '@/lib/mercado-highlight-presets'
import { sanitizeMercadoErro } from '@/lib/mercado-erro'
import { DEFAULT_MARKET_HIGHLIGHT_IDS, MAX_MARKET_HIGHLIGHTS } from '@/lib/mercado-highlight-ids'
import type { TendenciasEquityRow } from '@/lib/tendencias/types'

/** Moedas fiduciárias suportadas na UI (cotações e exibição). */
export type MercadoFiat = 'usd' | 'brl' | 'eur'

export type MercadoQuoteSlice = {
  price: number
  change_24h: number | null
  market_cap: number | null
}

export type MercadoCoin = {
  id: string
  name: string
  symbol: string
  /** Preço em USD (legado / CoinGecko markets). */
  price: number | null
  change_24h: number | null
  image: string | null
  market_cap: number | null
  source: 'coingecko'
  /** Cotações por moeda; destaques vêm do simple/price; top10/trending usam USD + taxas globais. */
  quotes?: Partial<Record<MercadoFiat, MercadoQuoteSlice>>
}

export type MarketApiPayload = {
  /** Ordem = pedido; null = moeda sem preço nesta resposta. */
  highlightCoins: (MercadoCoin | null)[]
  /** Eco dos ids pedidos (para o cliente). */
  highlightIds: string[]
  top10: MercadoCoin[]
  trending: MercadoCoin[]
  /** Ações US em tendência (volume / movimento; FMP ou xStock). */
  trendingStocks: TendenciasEquityRow[]
  cachedAt: string
  partial: boolean
  erro: string | null
  fonte: 'coingecko'
}

const TRENDING_PATH = '/search/trending'
const EXCHANGE_RATES_PATH = '/exchange_rates'
const MARKETS_PATH =
  '/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1'

const UA = 'yieldscan-market/1'
/** Evita 429 da API pública quando há muitos destaques + top10 + trending em paralelo. */
const SIMPLE_PRICE_CHUNK = 3
const SIMPLE_CHUNK_GAP_MS = 550
const SIMPLE_RETRY_GAP_MS = 650
const BETWEEN_ENDPOINTS_MS = 400
const FETCH_MAX_RETRIES = 2
const HIGHLIGHT_PRICE_CACHE_MS = 10 * 60 * 1000

type SimplePriceEntry = {
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

const highlightSimpleCache = new Map<string, { at: number; entry: SimplePriceEntry }>()

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
  binancecoin: { name: 'BNB', symbol: 'BNB' },
  dai: { name: 'Dai', symbol: 'DAI' },
  'shiba-inu': { name: 'Shiba Inu', symbol: 'SHIB' },
  tron: { name: 'TRON', symbol: 'TRX' },
  uniswap: { name: 'Uniswap', symbol: 'UNI' },
  'wrapped-bitcoin': { name: 'Wrapped Bitcoin', symbol: 'WBTC' },
  weth: { name: 'WETH', symbol: 'WETH' },
  'staked-ether': { name: 'Lido Staked Ether', symbol: 'STETH' },
  'ethereum-classic': { name: 'Ethereum Classic', symbol: 'ETC' },
  'nasdaq-xstock': { name: 'Nasdaq', symbol: 'QQQX' },
  'sp500-xstock': { name: 'S&P 500', symbol: 'SPYX' },
  'nvidia-xstock': { name: 'NVIDIA', symbol: 'NVDAX' },
  'tesla-xstock': { name: 'Tesla', symbol: 'TSLAX' },
  'microsoft-xstock': { name: 'Microsoft', symbol: 'MSFTX' },
  'alphabet-xstock': { name: 'Google', symbol: 'GOOGLX' },
  'meta-xstock': { name: 'Meta', symbol: 'METAX' },
  'amazon-xstock': { name: 'Amazon', symbol: 'AMZNX' },
  'microstrategy-xstock': { name: 'MicroStrategy', symbol: 'MSTRX' },
  'exxon-mobil-xstock': { name: 'Exxon Mobil', symbol: 'XOMX' },
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function cgApiUrl(path: string): string {
  const { base } = getCoingeckoRequestParts()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson<T>(pathOrUrl: string, timeoutMs = 12_000): Promise<T | null> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : cgApiUrl(pathOrUrl)
  const { headers: cgHeaders } = getCoingeckoRequestParts()
  const headers = { ...cgHeaders, 'User-Agent': UA }

  for (let attempt = 0; attempt <= FETCH_MAX_RETRIES; attempt++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        cache: 'no-store',
        signal: ctrl.signal,
      })
      if (res.status === 429 && attempt < FETCH_MAX_RETRIES) {
        await sleep(900 * (attempt + 1))
        continue
      }
      if (!res.ok) return null
      return (await res.json()) as T
    } catch {
      if (attempt < FETCH_MAX_RETRIES) {
        await sleep(600 * (attempt + 1))
        continue
      }
      return null
    } finally {
      clearTimeout(t)
    }
  }
  return null
}

function rememberHighlightSimple(id: string, entry: SimplePriceEntry): void {
  if (typeof entry.usd !== 'number' || !Number.isFinite(entry.usd)) return
  highlightSimpleCache.set(id, { at: Date.now(), entry })
}

function cachedHighlightSimple(id: string): SimplePriceEntry | null {
  const hit = highlightSimpleCache.get(id)
  if (!hit || Date.now() - hit.at > HIGHLIGHT_PRICE_CACHE_MS) return null
  return hit.entry
}

function hasValidUsd(entry: SimplePriceEntry | undefined): boolean {
  return typeof entry?.usd === 'number' && Number.isFinite(entry.usd)
}

async function fetchSimplePriceChunk(ids: string[]): Promise<Record<string, SimplePriceEntry>> {
  if (ids.length === 0) return {}
  const path = buildSimplePricePath(ids)
  const batch = await fetchJson<Record<string, SimplePriceEntry>>(path)
  const out: Record<string, SimplePriceEntry> = {}
  if (batch && typeof batch === 'object') {
    for (const [id, entry] of Object.entries(batch)) {
      if (entry && typeof entry === 'object' && hasValidUsd(entry)) {
        out[id] = entry
        rememberHighlightSimple(id, entry)
      }
    }
  }
  return out
}

/** simple/price em lotes + retry por id + cache (RWAs/xStock são sensíveis a 429). */
async function fetchSimplePricesForHighlights(ids: string[]): Promise<Record<string, SimplePriceEntry>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const merged: Record<string, SimplePriceEntry> = {}

  for (let i = 0; i < unique.length; i += SIMPLE_PRICE_CHUNK) {
    const chunk = unique.slice(i, i + SIMPLE_PRICE_CHUNK)
    Object.assign(merged, await fetchSimplePriceChunk(chunk))
    if (i + SIMPLE_PRICE_CHUNK < unique.length) {
      await sleep(SIMPLE_CHUNK_GAP_MS)
    }
  }

  for (const id of unique) {
    if (hasValidUsd(merged[id])) continue
    const cached = cachedHighlightSimple(id)
    if (cached && hasValidUsd(cached)) merged[id] = cached
  }

  const stillMissing = unique.filter((id) => !hasValidUsd(merged[id]))
  for (const id of stillMissing) {
    await sleep(SIMPLE_RETRY_GAP_MS)
    const one = await fetchSimplePriceChunk([id])
    if (hasValidUsd(one[id])) merged[id] = one[id]
  }

  return merged
}

/** Garante USD/BRL/EUR no cliente quando a resposta veio incompleta ou de cache antigo. */
export function withDisplayQuotes(coin: MercadoCoin, brlPerUsd = 5.5, eurPerUsd = 0.92): MercadoCoin {
  return enrichCoinQuotesFromUsd(usdOnlyQuotes(coin), brlPerUsd, eurPerUsd)
}

/** Preenche destaques sem preço a partir de cache global ou resposta anterior. */
export function mergeHighlightCoinsWithCache(
  ids: string[],
  coins: (MercadoCoin | null)[],
  byIdCache: Map<string, MercadoCoin>
): (MercadoCoin | null)[] {
  return ids.map((id, i) => {
    const cur = coins[i]
    if (cur?.price != null) return cur
    const cached = byIdCache.get(id)
    if (cached?.price != null) return fillHighlightStaticLogo(cached)
    const simple = cachedHighlightSimple(id)
    if (simple) {
      const fromSimple = fromSimpleHighlightById(id, simple)
      if (fromSimple?.price != null) return fillHighlightStaticLogo(fromSimple)
    }
    return cur
  })
}

export function rememberHighlightCoinsInCache(
  ids: string[],
  coins: (MercadoCoin | null)[],
  byIdCache: Map<string, MercadoCoin>
): void {
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const c = coins[i]
    if (!id || c?.price == null) continue
    byIdCache.set(id, c)
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

function parseFiatPerUsdFromExchangeRates(raw: unknown): { brlPerUsd: number; eurPerUsd: number } | null {
  const r = asRecord(raw)
  const rates = r && asRecord(r.rates)
  if (!rates) return null
  const usd = rates.usd
  const brl = rates.brl
  const eur = rates.eur
  const usdV = usd && typeof (usd as { value?: unknown }).value === 'number' ? (usd as { value: number }).value : NaN
  const brlV = brl && typeof (brl as { value?: unknown }).value === 'number' ? (brl as { value: number }).value : NaN
  const eurV = eur && typeof (eur as { value?: unknown }).value === 'number' ? (eur as { value: number }).value : NaN
  if (!Number.isFinite(usdV) || usdV <= 0 || !Number.isFinite(brlV) || !Number.isFinite(eurV)) return null
  return { brlPerUsd: brlV / usdV, eurPerUsd: eurV / usdV }
}

function sliceFromSimpleFiat(
  raw: SimplePriceEntry,
  fiat: MercadoFiat
): MercadoQuoteSlice | null {
  const p = raw[fiat]
  if (typeof p !== 'number' || !Number.isFinite(p)) return null
  const ext = raw as Record<string, unknown>
  const chKey = `${fiat}_24h_change`
  const capKey = `${fiat}_market_cap`
  const ch = ext[chKey]
  const cap = ext[capKey]
  return {
    price: p,
    change_24h: typeof ch === 'number' && Number.isFinite(ch) ? ch : null,
    market_cap: typeof cap === 'number' && Number.isFinite(cap) ? cap : null,
  }
}

function quotesFromSimpleEntry(raw: SimplePriceEntry): Partial<Record<MercadoFiat, MercadoQuoteSlice>> | undefined {
  const out: Partial<Record<MercadoFiat, MercadoQuoteSlice>> = {}
  for (const f of ['usd', 'brl', 'eur'] as const) {
    const s = sliceFromSimpleFiat(raw, f)
    if (s) out[f] = s
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function buildQuotesFromUsdBase(
  usdPrice: number,
  change: number | null,
  cap: number | null,
  brlPerUsd: number,
  eurPerUsd: number
): Partial<Record<MercadoFiat, MercadoQuoteSlice>> {
  return {
    usd: { price: usdPrice, change_24h: change, market_cap: cap },
    brl: {
      price: usdPrice * brlPerUsd,
      change_24h: change,
      market_cap: cap != null && Number.isFinite(cap) ? cap * brlPerUsd : null,
    },
    eur: {
      price: usdPrice * eurPerUsd,
      change_24h: change,
      market_cap: cap != null && Number.isFinite(cap) ? cap * eurPerUsd : null,
    },
  }
}

function enrichCoinQuotesFromUsd(
  coin: MercadoCoin,
  brlPerUsd: number,
  eurPerUsd: number
): MercadoCoin {
  const usdPrice =
    coin.quotes?.usd?.price ??
    (typeof coin.price === 'number' && Number.isFinite(coin.price) ? coin.price : null)
  if (usdPrice == null) return coin
  const change = coin.quotes?.usd?.change_24h ?? coin.change_24h
  const cap = coin.quotes?.usd?.market_cap ?? coin.market_cap
  const built = buildQuotesFromUsdBase(usdPrice, change, cap, brlPerUsd, eurPerUsd)
  const merged: Partial<Record<MercadoFiat, MercadoQuoteSlice>> = { ...built, ...coin.quotes }
  return {
    ...coin,
    quotes: merged,
    price: usdPrice,
    change_24h: change,
    market_cap: cap,
  }
}

function usdOnlyQuotes(coin: MercadoCoin): MercadoCoin {
  if (coin.quotes?.usd) return coin
  const p = coin.price
  if (typeof p !== 'number' || !Number.isFinite(p)) return coin
  return {
    ...coin,
    quotes: {
      ...coin.quotes,
      usd: {
        price: p,
        change_24h: coin.change_24h,
        market_cap: coin.market_cap,
      },
    },
  }
}

function metaForHighlightId(id: string): { name: string; symbol: string } {
  const k = KNOWN_COIN_META[id]
  if (k) return k
  return highlightMetaFromPresetOrId(id)
}

/** Cartão em destaque quando a API falha mas há preço manual nas definições. */
export function syntheticHighlightCoin(id: string): MercadoCoin {
  const slug = id.trim().toLowerCase()
  const m = metaForHighlightId(slug)
  return {
    id: slug,
    name: m.name,
    symbol: m.symbol,
    price: null,
    change_24h: null,
    image: COINGECKO_LOGO_BY_ID[slug] ?? SYMBOL_LOGO_URL[m.symbol] ?? null,
    market_cap: null,
    source: 'coingecko',
  }
}

function fromSimpleHighlightById(id: string, raw: SimplePriceEntry): MercadoCoin | null {
  const quotes = quotesFromSimpleEntry(raw)
  const usdPx =
    typeof raw.usd === 'number' && Number.isFinite(raw.usd)
      ? raw.usd
      : quotes?.usd?.price ?? null
  if (typeof usdPx !== 'number' || !Number.isFinite(usdPx)) return null
  const m = metaForHighlightId(id)
  const change =
    quotes?.usd?.change_24h ??
    (typeof raw.usd_24h_change === 'number' && Number.isFinite(raw.usd_24h_change)
      ? raw.usd_24h_change
      : null)
  const cap =
    quotes?.usd?.market_cap ??
    (typeof raw.usd_market_cap === 'number' && Number.isFinite(raw.usd_market_cap)
      ? raw.usd_market_cap
      : null)
  return {
    id,
    name: m.name,
    symbol: m.symbol,
    price: usdPx,
    change_24h: change,
    image: COINGECKO_LOGO_BY_ID[id] ?? null,
    market_cap: cap,
    source: 'coingecko',
    quotes,
  }
}

function coinHasResolvableLogo(coin: MercadoCoin | null): boolean {
  if (!coin) return false
  if (coin.image?.trim()) return true
  if (COINGECKO_LOGO_BY_ID[coin.id]) return true
  if (SYMBOL_LOGO_URL[coin.symbol.toUpperCase()]) return true
  return false
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

async function fetchHighlightLogosByIds(ids: string[]): Promise<Map<string, MercadoCoin>> {
  const unique = [...new Set(ids.map((id) => id.trim().toLowerCase()).filter(Boolean))]
  if (!unique.length) return new Map()
  const path = `/coins/markets?vs_currency=usd&ids=${unique.map(encodeURIComponent).join(',')}&order=market_cap_desc&per_page=${unique.length}&page=1&sparkline=false`
  const raw = await fetchJson<unknown[]>(path).catch(() => null)
  const out = new Map<string, MercadoCoin>()
  if (!Array.isArray(raw)) return out
  for (const row of raw) {
    const r = asRecord(row)
    if (!r) continue
    const c = normalizeMarketsRow(r)
    if (c) out.set(c.id, c)
  }
  return out
}

function mergeSimpleIntoCoin(coin: MercadoCoin, raw: SimplePriceEntry): MercadoCoin {
  const fromSimple = quotesFromSimpleEntry(raw)
  let next = { ...coin }
  if (fromSimple) {
    next = {
      ...next,
      quotes: { ...next.quotes, ...fromSimple },
    }
  }
  if (next.price == null && typeof raw.usd === 'number' && Number.isFinite(raw.usd)) {
    next = { ...next, price: raw.usd }
  }
  if (
    next.change_24h == null &&
    typeof raw.usd_24h_change === 'number' &&
    Number.isFinite(raw.usd_24h_change)
  ) {
    next = { ...next, change_24h: raw.usd_24h_change }
  }
  if (
    next.market_cap == null &&
    typeof raw.usd_market_cap === 'number' &&
    Number.isFinite(raw.usd_market_cap)
  ) {
    next = { ...next, market_cap: raw.usd_market_cap }
  }
  if (next.quotes?.usd) {
    next = {
      ...next,
      price: next.quotes.usd.price,
      change_24h: next.quotes.usd.change_24h,
      market_cap: next.quotes.usd.market_cap,
    }
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
    trendingStocks: [],
    cachedAt: new Date().toISOString(),
    partial,
    erro,
    fonte: 'coingecko',
  }
}

function buildSimplePricePath(ids: string[]): string {
  const unique = [...new Set(ids)].filter(Boolean)
  const joined = unique.map((id) => encodeURIComponent(id)).join(',')
  return `/simple/price?ids=${joined}&vs_currencies=usd,brl,eur&include_24hr_change=true&include_market_cap=true`
}

/**
 * Agrega os três endpoints públicos; tolera falhas parciais.
 * @param highlightIds slugs CoinGecko (ex.: bitcoin), até MAX_MARKET_HIGHLIGHTS.
 */
export async function agregarMercadoCoinGecko(
  highlightIds: string[] = [...DEFAULT_MARKET_HIGHLIGHT_IDS]
): Promise<MarketApiPayload> {
  const ids = [...new Set(highlightIds.filter(Boolean))].slice(0, MAX_MARKET_HIGHLIGHTS)
  if (ids.length === 0) {
    return emptyPayload(
      [...DEFAULT_MARKET_HIGHLIGHT_IDS],
      'Lista de destaques inválida.',
      true
    )
  }

  const hasCgKey = Boolean(
    process.env.COINGECKO_PRO_API_KEY?.trim() || process.env.COINGECKO_DEMO_API_KEY?.trim(),
  )

  let simpleRaw: Record<string, SimplePriceEntry>
  let exchangeRaw: unknown | null
  let marketsRaw: unknown[] | null
  let trendingRaw: { coins?: unknown[] } | null

  if (hasCgKey) {
    const [simple, exchange, markets, trending] = await Promise.all([
      fetchSimplePricesForHighlights(ids),
      fetchJson<unknown>(EXCHANGE_RATES_PATH).catch(() => null),
      fetchJson<unknown[]>(MARKETS_PATH).catch(() => null),
      fetchJson<{ coins?: unknown[] }>(TRENDING_PATH).catch(() => null),
    ])
    simpleRaw = simple
    exchangeRaw = exchange
    marketsRaw = markets
    trendingRaw = trending
  } else {
    simpleRaw = await fetchSimplePricesForHighlights(ids)
    await sleep(250)
    exchangeRaw = await fetchJson<unknown>(EXCHANGE_RATES_PATH)
    await sleep(250)
    ;[marketsRaw, trendingRaw] = await Promise.all([
      fetchJson<unknown[]>(MARKETS_PATH).catch(() => null),
      fetchJson<{ coins?: unknown[] }>(TRENDING_PATH).catch(() => null),
    ])
  }

  const fx = parseFiatPerUsdFromExchangeRates(exchangeRaw)
  const brlPerUsd = fx?.brlPerUsd ?? 5.5
  const eurPerUsd = fx?.eurPerUsd ?? 0.92

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
  }

  if (!fx) {
    partial = true
  }

  const top10Enriched = top10.map((c) => enrichCoinQuotesFromUsd(usdOnlyQuotes(c), brlPerUsd, eurPerUsd))
  top10.length = 0
  top10.push(...top10Enriched)

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

    if (coin && (coin.price != null || coin.quotes?.usd != null)) {
      coin = enrichCoinQuotesFromUsd(usdOnlyQuotes(coin), brlPerUsd, eurPerUsd)
    }

    if (!coin || coin.price == null) {
      partial = true
    }

    return fillHighlightStaticLogo(coin)
  })

  const needLogos = ids.filter((id, i) => !coinHasResolvableLogo(highlightCoins[i] ?? null))
  if (needLogos.length > 0) {
    const logos = await fetchHighlightLogosByIds(needLogos)
    for (let i = 0; i < highlightCoins.length; i++) {
      const cur = highlightCoins[i]
      const id = ids[i]!
      const fromMarket = logos.get(id)
      if (!cur || !fromMarket?.image) continue
      highlightCoins[i] = fillHighlightStaticLogo({
        ...cur,
        name: fromMarket.name || cur.name,
        symbol: fromMarket.symbol || cur.symbol,
        image: fromMarket.image ?? cur.image,
      })
    }
  }

  const missingHighlights = ids.filter((id, i) => {
    const c = highlightCoins[i]
    return !c || c.price == null
  })
  if (missingHighlights.length > 0) {
    if (missingHighlights.length === ids.length && Object.keys(simpleRaw).length === 0) {
      erros.push(
        'CoinGecko ocupada (limite da API). Os preços voltam em breve — usa «Actualizar» ou espera ~1 minuto.'
      )
    }
  }

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
  }

  const trendingEnriched = trending.map((c) => enrichCoinQuotesFromUsd(usdOnlyQuotes(c), brlPerUsd, eurPerUsd))
  trending.length = 0
  trending.push(...trendingEnriched)

  const anyHighlight = highlightCoins.some((c) => c != null && c.price != null)
  const semDados =
    top10.length === 0 && !anyHighlight && trending.length === 0

  return {
    highlightCoins,
    highlightIds: ids,
    top10,
    trending,
    trendingStocks: [],
    cachedAt: new Date().toISOString(),
    partial: partial || semDados,
    erro: sanitizeMercadoErro(
      semDados
        ? 'CoinGecko temporariamente indisponível. Tenta dentro de instantes.'
        : erros.length > 0
          ? erros.join(' ')
          : null,
    ),
    fonte: 'coingecko',
  }
}
