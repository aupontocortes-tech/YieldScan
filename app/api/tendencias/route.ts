import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag, unstable_cache } from 'next/cache'
import { fetchCryptoCvAsArticles } from '@/lib/crypto-cv-news'
import { fetchCryptopanicAsNewsDataArticles } from '@/lib/cryptopanic'
import { fetchGnewsAsArticles, fetchGnewsStocksAsArticles } from '@/lib/gnews'
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
import { fetchGoogleNewsMarketArticles } from '@/lib/tendencias/fetch-google-news'
import { fetchUsEquitiesSnapshot } from '@/lib/tendencias/fetch-us-equities'
import { mergeTrimNewsArticles } from '@/lib/tendencias/merge-news'
import { withTimeout } from '@/lib/fetch-timeout'
import {
  filtrarArtigosPortuguesParaFeed,
  traduzirArtigosBrutos,
} from '@/lib/traduzir-artigos-brutos'
import { buildTrimPayload } from '@/lib/tendencias/trim-engine'
import type { AnalysisTone, MomentumPeriod, TendenciasApiResponse } from '@/lib/tendencias/types'
import { fetchDefillamaEmissions } from '@/services/api/defillama-emissions'

export const maxDuration = 60

const PERIODS = new Set<MomentumPeriod>(['24h', '7d', '30d', '90d'])
const TONES = new Set<AnalysisTone>(['conservador', 'neutro', 'agressivo'])

const fetchRaw = unstable_cache(
  async () => {
    const [markets, global, trending, gnewsTrim, gnewsStocks, googleNews, cvNews, coindeskNews, cryptopanicNews, fmpQuotes, usEquities, emissions, chains, pools, fees, tvlGlobal] =
      await Promise.all([
        fetchTendenciasMarkets(70),
        fetchTendenciasGlobal(),
        fetchTendenciasTrending(),
        fetchGnewsAsArticles(),
        fetchGnewsStocksAsArticles(),
        fetchGoogleNewsMarketArticles(),
        fetchCryptoCvAsArticles(),
        fetchCoindeskAsArticles(45),
        fetchCryptopanicAsNewsDataArticles(),
        fetchFmpCryptoQuotes(),
        withTimeout(fetchUsEquitiesSnapshot(), 10_000, null),
        Promise.race([
          fetchDefillamaEmissions(),
          new Promise<{ data: never[]; error: string }>((r) =>
            setTimeout(() => r({ data: [], error: 'timeout' }), 8_000),
          ),
        ]).catch(() => ({ data: [] as never[], error: 'skip' })),
        fetchDefiChainsTop(8),
        withTimeout(fetchTopYieldPools(6), 6_000, []),
        withTimeout(fetchTopProtocolFees(20), 8_000, []),
        fetchGlobalTvlChange7d(),
      ])

    /**
     * Google News PT-BR garante volume sem chave; APIs dedicadas reforçam o conjunto.
     */
    const newsArticlesRaw = mergeTrimNewsArticles(
      gnewsTrim,
      googleNews,
      coindeskNews,
      cryptopanicNews,
      cvNews,
      gnewsStocks,
    )
    const newsArticlesTranslated = await withTimeout(
      traduzirArtigosBrutos(newsArticlesRaw, 60),
      28_000,
      null,
    )
    /**
     * Só português: traduzidas; se timeout OU tradução devolveu 0 (quota MyMemory, etc.),
     * cai para fontes já PT (ex. GNews cripto) — `[]` é truthy e antes engolia o fallback.
     */
    const traduzidasOk =
      newsArticlesTranslated != null && newsArticlesTranslated.length > 0
        ? newsArticlesTranslated
        : null
    const newsArticles =
      traduzidasOk ?? filtrarArtigosPortuguesParaFeed(newsArticlesRaw)

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
  ['tendencias-trim-v21'],
  { revalidate: 180, tags: ['tendencias'] },
)

function getTrimPayload(period: MomentumPeriod, tone: AnalysisTone): Promise<TendenciasApiResponse> {
  return unstable_cache(
    async () => {
      const raw = await fetchRaw()
      return buildTrimPayload({ ...raw, period, tone })
    },
    ['tendencias-trim-payload', period, tone],
    { revalidate: 180, tags: ['tendencias'] },
  )()
}

export async function GET(req: NextRequest) {
  const periodParam = req.nextUrl.searchParams.get('period') ?? '7d'
  const toneParam = req.nextUrl.searchParams.get('tone') ?? 'neutro'

  const period = PERIODS.has(periodParam as MomentumPeriod)
    ? (periodParam as MomentumPeriod)
    : '7d'
  const tone = TONES.has(toneParam as AnalysisTone) ? (toneParam as AnalysisTone) : 'neutro'

  try {
    const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'
    if (forceRefresh) {
      revalidateTag('tendencias')
    }

    const payload = await getTrimPayload(period, tone)

    const cacheHeaders = forceRefresh
      ? { 'Cache-Control': 'private, no-store, max-age=0' }
      : {
          'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=420',
          'X-Tendencias-Cache': 'trim-v21',
        }

    return NextResponse.json(
      {
        ...payload,
        ...(forceRefresh ? { refreshedAt: new Date().toISOString() } : {}),
      },
      { headers: cacheHeaders },
    )
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
          topCryptoMentions: [],
          topStockMentions: [],
          dominantNarrative: null,
          headlines: [],
          headlinesAll: [],
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
