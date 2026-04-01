import { NextResponse } from 'next/server'
import { agregarMercadoCoinGecko, type MarketApiPayload } from '@/lib/coingecko-market'

export const dynamic = 'force-dynamic'

const TTL_MS = 60_000

let memCache: { payload: MarketApiPayload; ts: number } | null = null
/** Último payload bem-sucedido (para servir se refresh falhar por completo). */
let staleFallback: MarketApiPayload | null = null

export async function GET() {
  const now = Date.now()

  if (memCache && now - memCache.ts < TTL_MS) {
    return NextResponse.json(memCache.payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'X-Market-Cache': 'hit',
      },
    })
  }

  try {
    const fresh = await agregarMercadoCoinGecko()

    const semNada =
      !fresh.highlights.bitcoin &&
      !fresh.highlights.ethereum &&
      fresh.top10.length === 0 &&
      fresh.trending.length === 0

    if (semNada && staleFallback) {
      const body: MarketApiPayload = {
        ...staleFallback,
        cachedAt: staleFallback.cachedAt,
        partial: true,
        erro: 'A mostrar últimos dados em cache; a API CoinGecko não respondeu.',
      }
      memCache = { payload: body, ts: now }
      return NextResponse.json(body, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          'X-Market-Cache': 'stale-fallback',
        },
      })
    }

    if (!semNada) {
      staleFallback = fresh
    }

    memCache = { payload: fresh, ts: now }

    return NextResponse.json(fresh, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'X-Market-Cache': 'miss',
      },
    })
  } catch {
    if (staleFallback) {
      const body: MarketApiPayload = {
        ...staleFallback,
        partial: true,
        erro: 'Erro ao atualizar; a mostrar dados anteriores.',
      }
      return NextResponse.json(body, {
        headers: {
          'Cache-Control': 'public, s-maxage=30',
          'X-Market-Cache': 'error-stale',
        },
      })
    }

    const empty = {
      highlights: { bitcoin: null, ethereum: null },
      top10: [],
      trending: [],
      cachedAt: new Date().toISOString(),
      partial: true,
      erro: 'Não foi possível obter dados de mercado.',
      fonte: 'coingecko' as const,
    }
    return NextResponse.json(empty, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
