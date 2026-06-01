import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { fetchCryptoCvAsArticles } from '@/lib/crypto-cv-news'
import { fetchCoindeskAsArticles } from '@/lib/tendencias/fetch-coindesk'
import {
  fetchDefiChainsTop,
  fetchGlobalTvlChange7d,
  fetchTopProtocolFees,
  fetchTopYieldPools,
} from '@/lib/tendencias/fetch-defi'
import {
  fetchTendenciasGlobal,
  fetchTendenciasMarkets,
  fetchTendenciasTrending,
} from '@/lib/tendencias/fetch-data'
import { fetchFmpCryptoQuotes, fmpQuotesToRecord } from '@/lib/tendencias/fetch-fmp'
import { fetchUsEquitiesSnapshot } from '@/lib/tendencias/fetch-us-equities'
import { mergeTrimNewsArticles } from '@/lib/tendencias/merge-news'
import { traduzirArtigosBrutos } from '@/lib/traduzir-artigos-brutos'
import { buildTrimPayload } from '@/lib/tendencias/trim-engine'
import type { AnalysisTone, MomentumPeriod } from '@/lib/tendencias/types'
import { fetchDefillamaEmissions } from '@/services/api/defillama-emissions'

export const maxDuration = 60

const PERIODS = new Set<MomentumPeriod>(['24h', '7d', '30d', '90d'])
const TONES = new Set<AnalysisTone>(['conservador', 'neutro', 'agressivo'])

const fetchRaw = unstable_cache(
  async () => {
    const [markets, global, trending, cvNews, coindeskNews, fmpQuotes, usEquities, emissions, chains, pools, fees, tvlGlobal] =
      await Promise.all([
        fetchTendenciasMarkets(100),
        fetchTendenciasGlobal(),
        fetchTendenciasTrending(),
        fetchCryptoCvAsArticles(),
        fetchCoindeskAsArticles(80),
        fetchFmpCryptoQuotes(),
        fetchUsEquitiesSnapshot(),
        Promise.race([
          fetchDefillamaEmissions(),
          new Promise<{ data: never[]; error: string }>((r) =>
            setTimeout(() => r({ data: [], error: 'timeout' }), 12_000),
          ),
        ]).catch(() => ({ data: [] as never[], error: 'skip' })),
        fetchDefiChainsTop(8),
        fetchTopYieldPools(6),
        fetchTopProtocolFees(40),
        fetchGlobalTvlChange7d(),
      ])

    const newsArticlesRaw = mergeTrimNewsArticles(coindeskNews, cvNews)
    const newsArticles = await traduzirArtigosBrutos(newsArticlesRaw, 30)

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

    let partial = false
    let error: string | null = null
    if (!markets.length) {
      partial = true
      error = 'Dados de mercado indisponíveis (CoinGecko).'
    }
    if (!newsArticles.length) partial = true

    return {
      markets,
      global,
      trending,
      newsArticles,
      fmpQuotes: fmpQuotesToRecord(fmpQuotes),
      usEquities,
      unlocks,
      defiChains: chains,
      defiPools: pools,
      defiFees: fees,
      defiTvlGlobal: tvlGlobal,
      partial,
      error,
    }
  },
  ['tendencias-trim-v9'],
  { revalidate: 120 },
)

export async function GET(req: NextRequest) {
  const periodParam = req.nextUrl.searchParams.get('period') ?? '7d'
  const toneParam = req.nextUrl.searchParams.get('tone') ?? 'neutro'

  const period = PERIODS.has(periodParam as MomentumPeriod)
    ? (periodParam as MomentumPeriod)
    : '7d'
  const tone = TONES.has(toneParam as AnalysisTone) ? (toneParam as AnalysisTone) : 'neutro'

  try {
    const raw = await fetchRaw()
    const payload = buildTrimPayload({
      ...raw,
      period,
      tone,
    })

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    })
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.error('[api/tendencias]', e)
    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        meta: {
          momentumPeriod: period,
          analysisTone: tone,
          engine: 'score-tendencia-v2',
          dataSources: ['coingecko', 'defillama', 'cryptocurrency.cv'],
        },
        market: {
          sentiment: 'neutro',
          sentimentScore: 50,
          btcDominance: null,
          totalVolume24h: null,
          totalMarketCap: null,
          marketCapChange24h: null,
          trendIndex: 50,
          trimMarketScore: 50,
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
          volumeAnormal: [],
          fundamentosFortes: [],
        },
        defi: {
          totalTvlUsd: null,
          tvlChange7dPct: null,
          topChains: [],
          topProtocols: [],
          summary: 'DeFi indisponível.',
        },
        equities: null,
        alerts: [],
        partial: true,
        error: 'Erro ao carregar tendências.',
      },
      { status: 200 },
    )
  }
}
