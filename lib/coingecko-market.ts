/**
 * CoinGecko API pública (sem chave) — agregação para /api/market.
 * Docs: https://docs.coingecko.com/reference
 */

import { COINGECKO_LOGO_BY_ID } from '@/lib/coingecko-static-logos'

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
  highlights: {
    bitcoin: MercadoCoin | null
    ethereum: MercadoCoin | null
    solana: MercadoCoin | null
    hyperliquid: MercadoCoin | null
  }
  top10: MercadoCoin[]
  trending: MercadoCoin[]
  cachedAt: string
  partial: boolean
  erro: string | null
  fonte: 'coingecko'
}

const SIMPLE_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd'
const TRENDING_URL = 'https://api.coingecko.com/api/v3/search/trending'
const MARKETS_URL =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1'

const UA = 'yieldscan-market/1 (public coingecko)'

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
    image: typeof raw.image === 'string' ? raw.image : null,
    market_cap: cap,
    source: 'coingecko',
  }
}

const HIGHLIGHT_IDS = ['bitcoin', 'ethereum', 'solana', 'hyperliquid'] as const
type HighlightCoinId = (typeof HIGHLIGHT_IDS)[number]

const HIGHLIGHT_META: Record<HighlightCoinId, { name: string; symbol: string }> = {
  bitcoin: { name: 'Bitcoin', symbol: 'BTC' },
  ethereum: { name: 'Ethereum', symbol: 'ETH' },
  solana: { name: 'Solana', symbol: 'SOL' },
  hyperliquid: { name: 'Hyperliquid', symbol: 'HYPE' },
}

function fromSimpleOnly(id: HighlightCoinId, usd: number): MercadoCoin {
  const m = HIGHLIGHT_META[id]
  return {
    id,
    name: m.name,
    symbol: m.symbol,
    price: usd,
    change_24h: null,
    image: COINGECKO_LOGO_BY_ID[id] ?? null,
    market_cap: null,
    source: 'coingecko',
  }
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

function emptyPayload(erro: string | null, partial: boolean): MarketApiPayload {
  return {
    highlights: { bitcoin: null, ethereum: null, solana: null, hyperliquid: null },
    top10: [],
    trending: [],
    cachedAt: new Date().toISOString(),
    partial,
    erro,
    fonte: 'coingecko',
  }
}

/**
 * Agrega os três endpoints públicos; tolera falhas parciais.
 */
export async function agregarMercadoCoinGecko(): Promise<MarketApiPayload> {
  const [simpleRaw, trendingRaw, marketsRaw] = await Promise.all([
    fetchJson<Record<string, { usd?: number }>>(SIMPLE_URL),
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

  let bitcoin: MercadoCoin | null = pick('bitcoin')
  let ethereum: MercadoCoin | null = pick('ethereum')
  let solana: MercadoCoin | null = pick('solana')
  let hyperliquid: MercadoCoin | null = pick('hyperliquid')

  if (simpleRaw && typeof simpleRaw.bitcoin?.usd === 'number') {
    if (!bitcoin) {
      bitcoin = fromSimpleOnly('bitcoin', simpleRaw.bitcoin.usd)
    } else if (bitcoin.price == null) {
      bitcoin = { ...bitcoin, price: simpleRaw.bitcoin.usd }
    }
  } else if (!bitcoin) {
    partial = true
    erros.push('Preço Bitcoin indisponível.')
  }

  if (simpleRaw && typeof simpleRaw.ethereum?.usd === 'number') {
    if (!ethereum) {
      ethereum = fromSimpleOnly('ethereum', simpleRaw.ethereum.usd)
    } else if (ethereum.price == null) {
      ethereum = { ...ethereum, price: simpleRaw.ethereum.usd }
    }
  } else if (!ethereum) {
    partial = true
    erros.push('Preço Ethereum indisponível.')
  }

  if (simpleRaw && typeof simpleRaw.solana?.usd === 'number') {
    if (!solana) {
      solana = fromSimpleOnly('solana', simpleRaw.solana.usd)
    } else if (solana.price == null) {
      solana = { ...solana, price: simpleRaw.solana.usd }
    }
  } else if (!solana) {
    partial = true
    erros.push('Preço Solana indisponível.')
  }

  if (simpleRaw && typeof simpleRaw.hyperliquid?.usd === 'number') {
    if (!hyperliquid) {
      hyperliquid = fromSimpleOnly('hyperliquid', simpleRaw.hyperliquid.usd)
    } else if (hyperliquid.price == null) {
      hyperliquid = { ...hyperliquid, price: simpleRaw.hyperliquid.usd }
    }
  } else if (!hyperliquid) {
    partial = true
    erros.push('Preço Hyperliquid indisponível.')
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
    erros.push('Trending indisponível.')
  }

  const semDados =
    top10.length === 0 &&
    !bitcoin &&
    !ethereum &&
    !solana &&
    !hyperliquid &&
    trending.length === 0

  return {
    highlights: { bitcoin, ethereum, solana, hyperliquid },
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
