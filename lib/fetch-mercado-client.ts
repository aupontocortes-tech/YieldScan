import type { MarketApiPayload } from '@/lib/coingecko-market'
import { sanitizeMercadoErro } from '@/lib/mercado-erro'
import {
  readMercadoSessionCache,
  writeMercadoSessionCache,
} from '@/lib/mercado-session-cache'

export const MERCADO_PRICES_QUERY_PREFIX = 'crypto-market-prices' as const
export const MERCADO_LISTS_QUERY_PREFIX = 'crypto-market-lists' as const

export function mercadoQueryKey(ids: string[]): string {
  return ids.join('|')
}

/** Cliente → /api/market (preços e listas CoinGecko). */
export async function fetchMercadoClient(
  ids: string[],
  mode: 'highlights' | 'full' = 'full',
): Promise<MarketApiPayload> {
  const q = new URLSearchParams()
  q.set('highlights', ids.join(','))
  if (mode === 'highlights') q.set('mode', 'highlights')
  const res = await fetch(`/api/market?${q.toString()}`)
  const json = (await res.json()) as MarketApiPayload
  return { ...json, erro: sanitizeMercadoErro(json.erro) }
}

export function readMercadoPricesPlaceholder(ids: string[]): MarketApiPayload | undefined {
  return readMercadoSessionCache(`${mercadoQueryKey(ids)}|prices`)
}

export function readMercadoFullPlaceholder(ids: string[]): MarketApiPayload | undefined {
  return readMercadoSessionCache(mercadoQueryKey(ids))
}

export async function fetchAndCacheMercadoPrices(ids: string[]): Promise<MarketApiPayload> {
  const key = mercadoQueryKey(ids)
  const payload = await fetchMercadoClient(ids, 'highlights')
  writeMercadoSessionCache(`${key}|prices`, payload)
  return payload
}

export async function fetchAndCacheMercadoFull(ids: string[]): Promise<MarketApiPayload> {
  const key = mercadoQueryKey(ids)
  const payload = await fetchMercadoClient(ids, 'full')
  const hasLists =
    payload.top10.length > 0 ||
    payload.trending.length > 0 ||
    (payload.trendingStocks?.length ?? 0) > 0
  if (hasLists) {
    writeMercadoSessionCache(key, payload)
  }
  return payload
}
