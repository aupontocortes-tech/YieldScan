import type { NewsDataArticle } from '@/lib/newsdata'
import {
  fmpDistFromHighPct,
  fmpMaPosition,
  lookupFmpQuote,
  type FmpCryptoQuote,
  type FmpQuotesRecord,
} from '@/lib/tendencias/fetch-fmp'
import { TRIM_CLASS_LABEL, SCORE_TENDENCIA_NOME } from '@/lib/tendencias/trim-config'
import type { RawGlobal, RawMarketCoin, RawTrending } from '@/lib/tendencias/fetch-data'
import {
  indexProtocolFees,
  type RawChainTvl,
  type RawProtocolFees,
  type RawYieldPool,
} from '@/lib/tendencias/fetch-defi'
import {
  analyzeTrimNews,
  newsSentimentToLevel,
  processTrimNewsArticles,
  type TrimNarrativeStats,
} from '@/lib/tendencias/trim-news'
import {
  buildTokenTrimScores,
  marketTrimScore,
  scoreVolume,
  type TrimTokenScores,
} from '@/lib/tendencias/trim-scores'
import { generateDefiInterpretation, generateObserveToday, generateTokenSummary } from '@/lib/tendencias/trim-text'
import type {
  AnalysisTone,
  MomentumPeriod,
  SentimentLevel,
  TendenciasAlert,
  TendenciasApiResponse,
  TendenciasDefiPanel,
  TendenciasMarketPanel,
  TendenciasNarrative,
  TendenciasTokenBuckets,
  TendenciasTokenRow,
} from '@/lib/tendencias/types'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function scoreToSentiment(score: number): SentimentLevel {
  if (score >= 62) return 'optimista'
  if (score <= 38) return 'pessimista'
  return 'neutro'
}

function narrativeSentiment(n: TrimNarrativeStats): SentimentLevel {
  const diff = n.posCount - n.negCount
  return scoreToSentiment(50 + diff * 10)
}

function toTokenRow(
  c: RawMarketCoin,
  trim: TrimTokenScores,
  mentionCount: number,
  period: MomentumPeriod,
  fmp?: FmpCryptoQuote,
): TendenciasTokenRow {
  const price = c.current_price
  return {
    id: c.id,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    image: c.image,
    price,
    change24h: c.price_change_percentage_24h,
    change7d: c.price_change_percentage_7d_in_currency ?? null,
    change30d: c.price_change_percentage_30d_in_currency ?? null,
    changePeriod:
      period === '7d'
        ? c.price_change_percentage_7d_in_currency ?? c.price_change_percentage_24h
        : period === '30d'
          ? c.price_change_percentage_30d_in_currency
          : c.price_change_percentage_200d_in_currency ?? c.price_change_percentage_30d_in_currency,
    volume24h: c.total_volume,
    marketCap: c.market_cap,
    sentiment: scoreToSentiment(trim.trimScore),
    aiScore: trim.trimScore,
    trimScore: trim.trimScore,
    trimClass: trim.trimClass,
    trimLabel: trim.trimLabel,
    subScores: {
      momentum: trim.momentum,
      volume: trim.volume,
      news: trim.news,
      defi: trim.defi,
      relevance: trim.relevance,
    },
    momentum: trim.momentumClass,
    momentumLabel: TRIM_CLASS_LABEL[trim.trimClass],
    momentumReason: generateTokenSummary(c, trim, null, 'neutro'),
    strength: trim.strength,
    mentionCount: mentionCount || undefined,
    fmp: fmp
      ? {
          vsMa50: fmpMaPosition(price, fmp.ma50),
          vsMa200: fmpMaPosition(price, fmp.ma200),
          distYearHighPct: fmpDistFromHighPct(price, fmp.yearHigh),
        }
      : undefined,
  }
}

function buildNarratives(stats: TrimNarrativeStats[]): TendenciasNarrative[] {
  return stats.map((n) => ({
    id: n.id,
    label: n.label,
    summary: `${n.label} concentra ${n.mentionCount} menção${n.mentionCount === 1 ? '' : 'ões'} (${n.posCount} positivas, ${n.negCount} negativas). Intensidade ${Math.round(n.frequency * 100)}% do feed.`,
    impact: n.mentionCount >= 5 ? 'alto' : n.mentionCount >= 2 ? 'medio' : 'baixo',
    sentiment: narrativeSentiment(n),
    relatedSymbols: n.relatedSymbols,
    mentionCount: n.mentionCount,
    intensity: clamp(Math.round(n.frequency * 100 + n.mentionCount * 8), 0, 100),
  }))
}

function buildMarketPanel(
  global: RawGlobal | null,
  markets: RawMarketCoin[],
  marketTrim: number,
  newsScore: number,
  narratives: TendenciasNarrative[],
): TendenciasMarketPanel {
  const changes = markets.map((m) => m.price_change_percentage_24h ?? 0).filter(Number.isFinite)
  const avgChange = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : 0
  const sentimentScore = clamp(Math.round(marketTrim * 0.55 + newsScore * 0.45), 0, 100)

  return {
    sentiment: scoreToSentiment(sentimentScore),
    sentimentScore,
    btcDominance: global?.market_cap_percentage?.btc ?? null,
    totalVolume24h: global?.total_volume?.usd ?? null,
    totalMarketCap: global?.total_market_cap?.usd ?? null,
    marketCapChange24h: global?.market_cap_change_percentage_24h_usd ?? null,
    trendIndex: clamp(Math.round(marketTrim + avgChange * 2), 0, 100),
    trimMarketScore: marketTrim,
    dominantNarrative: narratives[0]?.label ?? null,
    gainersCount: changes.filter((c) => c > 1).length,
    losersCount: changes.filter((c) => c < -1).length,
  }
}

function buildDefiPanel(
  chains: RawChainTvl[],
  pools: RawYieldPool[],
  fees: RawProtocolFees[],
  tvlGlobal: { current: number | null; changePct: number | null },
): TendenciasDefiPanel {
  const topProtocols = pools.slice(0, 6).map((p) => {
    const feeMatch = fees.find(
      (f) => f.name.toLowerCase() === (p.project ?? '').toLowerCase(),
    )
    return {
      name: p.project ?? 'Protocolo',
      chain: p.chain ?? '—',
      tvlUsd: p.tvlUsd ?? null,
      apy: p.apy ?? null,
      symbol: p.symbol ?? feeMatch?.symbol ?? null,
      fees24h: feeMatch?.fees24h ?? null,
      revenue24h: feeMatch?.revenue24h ?? null,
      interpretation: generateDefiInterpretation({
        name: p.project ?? 'Protocolo',
        tvlChange: tvlGlobal.changePct,
        feesChange: feeMatch?.change_1d,
        revenue24h: feeMatch?.revenue24h,
      }),
    }
  })

  let summary = 'Dados DeFi indisponíveis neste momento.'
  if (tvlGlobal.current != null) {
    summary =
      tvlGlobal.changePct != null
        ? `TVL agregado DeFi ~${(tvlGlobal.current / 1e9).toFixed(2)}B USD (${tvlGlobal.changePct >= 0 ? '+' : ''}${tvlGlobal.changePct.toFixed(1)}% em 7d).`
        : `TVL agregado DeFi ~${(tvlGlobal.current / 1e9).toFixed(2)}B USD.`
    if (topProtocols[0]) summary += ` ${topProtocols[0].interpretation}`
  }

  return {
    totalTvlUsd: tvlGlobal.current,
    tvlChange7dPct: tvlGlobal.changePct,
    topChains: chains.map((c) => ({ name: c.name, tvlUsd: c.tvl })),
    topProtocols,
    summary,
  }
}

function buildAlerts(input: {
  markets: RawMarketCoin[]
  trimById: Map<string, TrimTokenScores>
  rows: TendenciasTokenRow[]
  news: { topMentions: Array<{ symbol: string; count: number }>; dominantNarrative: string | null }
  prevNarrative?: string | null
  defi: TendenciasDefiPanel
  unlocks: TendenciasTokenBuckets['proximosUnlocks']
}): TendenciasAlert[] {
  const alerts: TendenciasAlert[] = []

  for (const c of input.markets) {
    const vol = scoreVolume(c)
    if (vol.abnormal && vol.ratio > 0.22) {
      alerts.push({
        id: `vol-${c.id}`,
        type: 'volume',
        title: `Volume anormal — ${c.symbol.toUpperCase()}`,
        detail: `Rácio volume/cap ${(vol.ratio * 100).toFixed(0)}% (24h).`,
        severity: vol.ratio > 0.35 ? 'urgent' : 'watch',
        symbol: c.symbol.toUpperCase(),
      })
      break
    }
  }

  const topM = input.news.topMentions[0]
  if (topM && topM.count >= 2) {
    alerts.push({
      id: `mention-${topM.symbol}`,
      type: 'mencoes',
      title: `${topM.symbol} muito citado`,
      detail: `${topM.count} menções no feed de notícias.`,
      severity: topM.count >= 4 ? 'watch' : 'info',
      symbol: topM.symbol,
    })
  }

  for (const r of input.rows.filter((t) => t.trimClass === 'acelerando').slice(0, 2)) {
    alerts.push({
      id: `trim-${r.id}`,
      type: 'momentum',
      title: `${r.symbol} — score ${r.trimScore}`,
      detail: r.momentumReason,
      severity: 'info',
      symbol: r.symbol,
    })
  }

  for (const r of input.rows.filter((t) => t.trimClass === 'fraco').slice(0, 1)) {
    alerts.push({
      id: `weak-${r.id}`,
      type: 'momentum',
      title: `${r.symbol} — perda de força`,
      detail: `${SCORE_TENDENCIA_NOME} ${r.trimScore}/100 (${r.trimLabel}).`,
      severity: 'watch',
      symbol: r.symbol,
    })
  }

  for (const u of input.unlocks.slice(0, 2)) {
    alerts.push({
      id: `unlock-${u.symbol}`,
      type: 'unlock',
      title: `Unlock — ${u.symbol}`,
      detail: u.unlockAt
        ? `Previsto ${new Date(u.unlockAt).toLocaleDateString('pt-PT')}.`
        : 'Supply pendente relevante.',
      severity: 'watch',
      symbol: u.symbol,
    })
  }

  if (input.defi.tvlChange7dPct != null && Math.abs(input.defi.tvlChange7dPct) > 4) {
    alerts.push({
      id: 'tvl-global',
      type: 'tvl',
      title: 'Movimento de TVL DeFi',
      detail: `${input.defi.tvlChange7dPct >= 0 ? '+' : ''}${input.defi.tvlChange7dPct.toFixed(1)}% em 7 dias.`,
      severity: Math.abs(input.defi.tvlChange7dPct) > 8 ? 'urgent' : 'watch',
    })
  }

  if (
    input.news.dominantNarrative &&
    input.prevNarrative &&
    input.news.dominantNarrative !== input.prevNarrative
  ) {
    alerts.push({
      id: 'narr-shift',
      type: 'narrativa',
      title: 'Mudança de narrativa',
      detail: `De «${input.prevNarrative}» para «${input.news.dominantNarrative}».`,
      severity: 'info',
    })
  }

  return alerts.slice(0, 12)
}

function buildDataSources(input: {
  fmpQuotes?: FmpQuotesRecord
  newsArticles: NewsDataArticle[]
}): string[] {
  const sources = ['coingecko', 'defillama']
  if (input.fmpQuotes && Object.keys(input.fmpQuotes).length) sources.push('fmp')
  const hasCoindesk = input.newsArticles.some((a) => String(a.article_id ?? '').startsWith('coindesk-'))
  const hasCv = input.newsArticles.some((a) => String(a.article_id ?? '').startsWith('cryptocv-'))
  if (hasCoindesk) sources.push('coindesk')
  if (hasCv || !hasCoindesk) sources.push('cryptocurrency.cv')
  return sources
}

export function buildTrimPayload(input: {
  markets: RawMarketCoin[]
  global: RawGlobal | null
  trending: RawTrending[]
  newsArticles: NewsDataArticle[]
  unlocks?: TendenciasTokenBuckets['proximosUnlocks']
  defiChains?: RawChainTvl[]
  defiPools?: RawYieldPool[]
  defiFees?: RawProtocolFees[]
  defiTvlGlobal?: { current: number | null; changePct: number | null }
  fmpQuotes?: FmpQuotesRecord
  period?: MomentumPeriod
  tone?: AnalysisTone
  partial?: boolean
  error?: string | null
}): TendenciasApiResponse {
  const period = input.period ?? '7d'
  const tone = input.tone ?? 'neutro'

  const articles = processTrimNewsArticles(input.newsArticles)
  const newsAnalysis = analyzeTrimNews(articles)
  const { byGecko, bySymbol } = indexProtocolFees(input.defiFees ?? [])

  const trimById = buildTokenTrimScores({
    markets: input.markets,
    trending: input.trending,
    tokenNewsScore: newsAnalysis.tokenNewsScore,
    tokenMentions: newsAnalysis.tokenMentions,
    feesByGecko: byGecko,
    feesBySymbol: bySymbol,
    period,
  })

  const rows = input.markets.map((c) => {
    const trim = trimById.get(c.id)!
    const fmp = lookupFmpQuote(input.fmpQuotes, c.symbol.toUpperCase())
    return toTokenRow(c, trim, newsAnalysis.tokenMentions.get(c.symbol.toUpperCase()) ?? 0, period, fmp)
  })

  const byTrim = [...rows].sort((a, b) => (b.trimScore ?? 0) - (a.trimScore ?? 0))
  const byVolume = [...rows].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
  const byMentions = [...rows].sort((a, b) => (b.mentionCount ?? 0) - (a.mentionCount ?? 0))
  const byChangeUp = [...rows].sort(
    (a, b) => (b.changePeriod ?? 0) - (a.changePeriod ?? 0),
  )
  const byChangeDown = [...rows].sort(
    (a, b) => (a.changePeriod ?? 0) - (b.changePeriod ?? 0),
  )

  const buckets: TendenciasTokenBuckets = {
    maisComentados: byMentions.slice(0, 8),
    maisPositivos: byChangeUp.slice(0, 8),
    maisNegativos: byChangeDown.slice(0, 8),
    maiorVolume: byVolume.slice(0, 8),
    acelerando: byTrim.filter((r) => r.trimClass === 'acelerando' || r.trimClass === 'forte').slice(0, 8),
    desacelerando: byTrim.filter((r) => r.trimClass === 'fraco' || r.trimClass === 'estavel').slice(0, 8),
    proximosUnlocks: input.unlocks ?? [],
    volumeAnormal: rows.filter((r) => {
      const c = input.markets.find((m) => m.id === r.id)
      return c ? scoreVolume(c).abnormal : false
    }).slice(0, 6),
    fundamentosFortes: byTrim.filter((r) => (r.subScores?.defi ?? 50) >= 62).slice(0, 6),
  }

  const narratives = buildNarratives(newsAnalysis.narratives)
  const trimScoresArr = [...trimById.values()]
  const mTrim = marketTrimScore(trimScoresArr)
  const newsAggregate =
    articles.length > 0
      ? articles.reduce((s, a) => s + a.sentimentScore, 0) / articles.length
      : 50

  const defi = buildDefiPanel(
    input.defiChains ?? [],
    input.defiPools ?? [],
    input.defiFees ?? [],
    input.defiTvlGlobal ?? { current: null, changePct: null },
  )

  const market = buildMarketPanel(input.global, input.markets, mTrim, newsAggregate, narratives)

  const topAccel = [...input.markets]
    .sort((a, b) => (trimById.get(b.id)?.trimScore ?? 0) - (trimById.get(a.id)?.trimScore ?? 0))[0]

  const observeToday = generateObserveToday({
    marketTrimScore: mTrim,
    marketSentiment: market.sentiment,
    dominantNarrative: market.dominantNarrative,
    gainers: market.gainersCount,
    losers: market.losersCount,
    period,
    topAccel: topAccel ?? null,
    topAccelTrim: topAccel ? trimById.get(topAccel.id) ?? null : null,
    defiSummary: defi.summary,
    tone,
  })

  const alerts = buildAlerts({
    markets: input.markets,
    trimById,
    rows,
    news: newsAnalysis.insight,
    defi,
    unlocks: buckets.proximosUnlocks,
  })

  return {
    updatedAt: new Date().toISOString(),
    meta: {
      momentumPeriod: period,
      analysisTone: tone,
      engine: 'score-tendencia-v2',
      dataSources: buildDataSources(input),
    },
    market,
    observeToday,
    news: newsAnalysis.insight,
    narratives,
    buckets,
    defi,
    alerts,
    partial: input.partial ?? false,
    error: input.error ?? null,
  }
}
