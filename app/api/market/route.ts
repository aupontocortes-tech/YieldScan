import { NextRequest, NextResponse } from 'next/server'
import {
  agregarMercadoCoinGecko,
  mergeHighlightCoinsWithCache,
  rememberHighlightCoinsInCache,
  type MarketApiPayload,
  type MercadoCoin,
} from '@/lib/coingecko-market'
import { parseHighlightsQueryParam } from '@/lib/mercado-highlight-ids'
import { fetchMercadoStocksTrending } from '@/lib/tendencias/fetch-us-equities'

export const dynamic = 'force-dynamic'

const TTL_MS = 60_000

type CacheEntry = { payload: MarketApiPayload; ts: number }

const memCache = new Map<string, CacheEntry>()
const staleFallback = new Map<string, MarketApiPayload>()
/** Preços por slug — sobrevive a mudanças na lista de destaques e a 429 pontuais. */
const highlightByIdCache = new Map<string, MercadoCoin>()

function applyHighlightIdCache(payload: MarketApiPayload): MarketApiPayload {
  const highlightCoins = mergeHighlightCoinsWithCache(
    payload.highlightIds,
    payload.highlightCoins,
    highlightByIdCache
  )
  rememberHighlightCoinsInCache(payload.highlightIds, highlightCoins, highlightByIdCache)
  const anyFromCache = highlightCoins.some(
    (c, i) => c?.price != null && payload.highlightCoins[i]?.price == null
  )
  return {
    ...payload,
    highlightCoins,
    partial: payload.partial || anyFromCache,
    erro: anyFromCache
      ? payload.erro
        ? `${payload.erro} Alguns valores vêm de cache recente.`
        : 'Alguns valores vêm de cache recente.'
      : payload.erro,
  }
}

export async function GET(req: NextRequest) {
  const now = Date.now()
  const highlightIds = parseHighlightsQueryParam(req.nextUrl.searchParams.get('highlights'))
  const cacheKey = highlightIds.join(',')

  const hit = memCache.get(cacheKey)
  if (hit && now - hit.ts < TTL_MS) {
    return NextResponse.json(applyHighlightIdCache(hit.payload), {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'X-Market-Cache': 'hit',
      },
    })
  }

  try {
    const [base, trendingStocks] = await Promise.all([
      agregarMercadoCoinGecko(highlightIds),
      fetchMercadoStocksTrending(),
    ])
    const fresh = applyHighlightIdCache({ ...base, trendingStocks })

    const anyHighlight = fresh.highlightCoins.some((c) => c != null && c.price != null)
    const semNada =
      !anyHighlight && fresh.top10.length === 0 && fresh.trending.length === 0

    if (semNada) {
      const fallback = staleFallback.get(cacheKey)
      if (fallback) {
        const body = applyHighlightIdCache({
          ...fallback,
          cachedAt: fallback.cachedAt,
          partial: true,
          erro: 'A mostrar últimos dados em cache; a API CoinGecko não respondeu.',
        })
        memCache.set(cacheKey, { payload: body, ts: now })
        return NextResponse.json(body, {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
            'X-Market-Cache': 'stale-fallback',
          },
        })
      }
    }

    if (!semNada) {
      staleFallback.set(cacheKey, fresh)
    }

    memCache.set(cacheKey, { payload: fresh, ts: now })

    return NextResponse.json(fresh, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'X-Market-Cache': 'miss',
      },
    })
  } catch {
    const fallback = staleFallback.get(cacheKey)
    if (fallback) {
      const body = applyHighlightIdCache({
        ...fallback,
        partial: true,
        erro: 'Erro ao actualizar; a mostrar dados anteriores.',
      })
      return NextResponse.json(body, {
        headers: {
          'Cache-Control': 'public, s-maxage=30',
          'X-Market-Cache': 'error-stale',
        },
      })
    }

    const empty: MarketApiPayload = {
      highlightCoins: highlightIds.map(() => null),
      highlightIds,
      top10: [],
      trending: [],
      trendingStocks: [],
      cachedAt: new Date().toISOString(),
      partial: true,
      erro: 'Não foi possível obter dados de mercado.',
      fonte: 'coingecko',
    }
    return NextResponse.json(empty, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
