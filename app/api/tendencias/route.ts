import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { pegarTodasNoticias, processarNoticias } from '@/lib/newsdata'
import {
  fetchDefiChainsTop,
  fetchGlobalTvlChange7d,
  fetchTopYieldPools,
} from '@/lib/tendencias/fetch-defi'
import {
  fetchTendenciasGlobal,
  fetchTendenciasMarkets,
  fetchTendenciasTrending,
} from '@/lib/tendencias/fetch-data'
import { buildTendenciasPayload } from '@/lib/tendencias/intelligence'
import { enrichTendenciasWithLlm } from '@/lib/tendencias/llm-enrich'
import type { AnalysisTone, MomentumPeriod } from '@/lib/tendencias/types'
import { fetchDefillamaEmissions } from '@/services/api/defillama-emissions'

export const maxDuration = 60

const PERIODS = new Set<MomentumPeriod>(['7d', '30d', '90d'])
const TONES = new Set<AnalysisTone>(['conservador', 'neutro', 'agressivo'])

const fetchRaw = unstable_cache(
  async () => {
    const [markets, global, trending, newsRaw, emissions, chains, pools, tvlGlobal] =
      await Promise.all([
        fetchTendenciasMarkets(100),
        fetchTendenciasGlobal(),
        fetchTendenciasTrending(),
        pegarTodasNoticias(process.env.NEWSDATA_API_KEY).catch(() => ({
          results: [],
          erro: 'news_fail' as const,
        })),
        fetchDefillamaEmissions().catch(() => ({ data: [] as never[], error: 'skip' })),
        fetchDefiChainsTop(8),
        fetchTopYieldPools(6),
        fetchGlobalTvlChange7d(),
      ])

    const noticias = newsRaw.results?.length ? processarNoticias(newsRaw.results) : []

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
      error = 'Dados de mercado indisponíveis.'
    }
    if (!noticias.length) partial = true

    return {
      markets,
      global,
      trending,
      noticias,
      unlocks,
      defiChains: chains,
      defiPools: pools,
      defiTvlGlobal: tvlGlobal,
      partial,
      error,
    }
  },
  ['tendencias-raw-v2'],
  { revalidate: 120 }
)

export async function GET(req: NextRequest) {
  const periodParam = req.nextUrl.searchParams.get('period') ?? '7d'
  const toneParam = req.nextUrl.searchParams.get('tone') ?? 'neutro'
  const customNote = req.nextUrl.searchParams.get('note') ?? ''
  const useLlm = req.nextUrl.searchParams.get('llm') !== '0'

  const period = PERIODS.has(periodParam as MomentumPeriod)
    ? (periodParam as MomentumPeriod)
    : '7d'
  const tone = TONES.has(toneParam as AnalysisTone) ? (toneParam as AnalysisTone) : 'neutro'

  try {
    const raw = await fetchRaw()
    let payload = buildTendenciasPayload({
      ...raw,
      period,
      tone,
    })

    if (useLlm && payload.meta.llmEnabled) {
      payload = await enrichTendenciasWithLlm(payload, {
        tone,
        customNote: customNote || undefined,
      })
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    })
  } catch {
    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        meta: {
          momentumPeriod: period,
          analysisTone: tone,
          llmEnabled: Boolean(process.env.OPENAI_API_KEY?.trim()),
          llmUsed: false,
          fmpConfigured: Boolean(process.env.FMP_API_KEY?.trim()),
        },
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
        defi: {
          totalTvlUsd: null,
          tvlChange7dPct: null,
          topChains: [],
          topProtocols: [],
          summary: 'DeFi indisponível.',
        },
        alerts: [],
        partial: true,
        error: 'Erro ao carregar tendências.',
      },
      { status: 200 }
    )
  }
}
