import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { pegarTodasNoticias, processarNoticias } from '@/lib/newsdata'
import {
  fetchTendenciasGlobal,
  fetchTendenciasMarkets,
  fetchTendenciasTrending,
} from '@/lib/tendencias/fetch-data'
import { buildTendenciasPayload } from '@/lib/tendencias/intelligence'
import { fetchDefillamaEmissions } from '@/services/api/defillama-emissions'

export const maxDuration = 60

const buildPayload = unstable_cache(
  async () => {
    let partial = false
    let error: string | null = null

    const [markets, global, trending, newsRaw, emissions] = await Promise.all([
      fetchTendenciasMarkets(100),
      fetchTendenciasGlobal(),
      fetchTendenciasTrending(),
      pegarTodasNoticias(process.env.NEWSDATA_API_KEY).catch(() => ({
        results: [],
        erro: 'news_fail' as const,
      })),
      fetchDefillamaEmissions().catch(() => ({ data: [] as never[], error: 'skip' })),
    ])

    if (!markets.length) {
      partial = true
      error = 'Dados de mercado indisponíveis; tenta actualizar em instantes.'
    }
    if (!global) partial = true

    const noticias = newsRaw.results?.length ? processarNoticias(newsRaw.results) : []
    if (!noticias.length) partial = true

    const now = Date.now()
    const unlocks = (emissions.data ?? [])
      .map((row) => {
        const geckoId = row.gecko_id ?? null
        const nextAt = row.nextEvent?.date
        const tokens = row.nextEvent?.toUnlock ?? 0
        if (!nextAt || !tokens) return null
        const tsMs = nextAt > 1e12 ? nextAt : nextAt * 1000
        if (tsMs < now || tsMs > now + 30 * 86_400_000) return null
        const price =
          markets.find((m) => m.id === geckoId)?.current_price ??
          (row.mcap && row.circSupply ? row.mcap / row.circSupply : null)
        return {
          symbol: (row.token ?? row.name ?? '—').toUpperCase().slice(0, 12),
          name: row.name ?? row.token ?? 'Token',
          geckoId,
          unlockAt: tsMs,
          usdValue: price && tokens > 0 ? tokens * price : null,
        }
      })
      .filter((u): u is NonNullable<typeof u> => u != null)
      .sort((a, b) => (a.unlockAt ?? 0) - (b.unlockAt ?? 0))
      .slice(0, 6)

    return buildTendenciasPayload({
      markets,
      global,
      trending,
      noticias,
      unlocks,
      partial,
      error,
    })
  },
  ['tendencias-intelligence-v1'],
  { revalidate: 120 }
)

export async function GET() {
  try {
    const payload = await buildPayload()
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    })
  } catch {
    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        market: {
          sentiment: 'neutro',
          sentimentScore: 50,
          btcDominance: null,
          totalVolume24h: null,
          totalMarketCap: null,
          marketCapChange24h: null,
          trendIndex: 50,
          dominantNarrative: null,
          gainersCount: 0,
          losersCount: 0,
        },
        observeToday: 'Não foi possível gerar a análise neste momento.',
        news: {
          positivo: 0,
          neutro: 0,
          negativo: 0,
          topMentions: [],
          dominantNarrative: null,
          headlines: [],
        },
        narratives: [],
        buckets: {
          maisComentados: [],
          maisPositivos: [],
          maisNegativos: [],
          maiorVolume: [],
          acelerando: [],
          desacelerando: [],
          proximosUnlocks: [],
        },
        alerts: [],
        partial: true,
        error: 'Erro ao carregar tendências.',
      },
      { status: 200 }
    )
  }
}
