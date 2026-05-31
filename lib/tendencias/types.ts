import type { TrimClass } from '@/lib/tendencias/trim-config'

export type SentimentLevel = 'optimista' | 'neutro' | 'pessimista'

export type MomentumClass = 'acelerando' | 'estavel' | 'fraco' | 'reversao'

export type MomentumPeriod = '24h' | '7d' | '30d' | '90d'

export type AnalysisTone = 'conservador' | 'neutro' | 'agressivo'

export type TendenciasNarrativeId =
  | 'etfs'
  | 'ia'
  | 'memecoins'
  | 'defi'
  | 'stablecoins'
  | 'regulacao'
  | 'layer2'
  | 'hacks'
  | 'institucionais'
  | 'rwa'
  | 'gaming'

export type TrimSubScores = {
  momentum: number
  volume: number
  news: number
  defi: number
  relevance: number
}

export type TendenciasTokenRow = {
  id: string
  symbol: string
  name: string
  image: string | null
  price: number | null
  change24h: number | null
  change7d: number | null
  change30d: number | null
  changePeriod: number | null
  volume24h: number | null
  marketCap: number | null
  sentiment: SentimentLevel
  /** Score de Tendência composto 0–100 */
  aiScore: number
  trimScore: number
  trimClass: TrimClass
  trimLabel: string
  subScores?: TrimSubScores
  momentum: MomentumClass
  momentumLabel: string
  momentumReason: string
  strength: number
  mentionCount?: number
  /** Dados FMP (MM 50/200, máx 52 semanas) quando FMP_API_KEY configurada */
  fmp?: {
    vsMa50: 'above' | 'below' | null
    vsMa200: 'above' | 'below' | null
    distYearHighPct: number | null
  }
}

export type TendenciasNarrative = {
  id: TendenciasNarrativeId
  label: string
  summary: string
  impact: 'alto' | 'medio' | 'baixo'
  sentiment: SentimentLevel
  relatedSymbols: string[]
  mentionCount: number
  intensity: number
}

export type TendenciasAlert = {
  id: string
  type: 'volume' | 'sentimento' | 'mencoes' | 'momentum' | 'unlock' | 'tvl' | 'breakout' | 'narrativa'
  title: string
  detail: string
  severity: 'info' | 'watch' | 'urgent'
  symbol?: string
}

export type TendenciasNewsHeadline = {
  titulo: string
  impacto: string
  categoria: string
  link: string
  sentiment: SentimentLevel
  relevance: number
  intensity: number
  mentionCount: number
}

export type TendenciasNewsInsight = {
  positivo: number
  neutro: number
  negativo: number
  topMentions: Array<{ symbol: string; count: number }>
  dominantNarrative: string | null
  headlines: TendenciasNewsHeadline[]
}

export type TendenciasMarketPanel = {
  sentiment: SentimentLevel
  sentimentScore: number
  btcDominance: number | null
  totalVolume24h: number | null
  totalMarketCap: number | null
  marketCapChange24h: number | null
  trendIndex: number
  /** Score de Tendência médio dos top 20 tokens */
  trimMarketScore: number
  dominantNarrative: string | null
  gainersCount: number
  losersCount: number
}

export type TendenciasDefiProtocol = {
  name: string
  chain: string
  tvlUsd: number | null
  apy: number | null
  symbol: string | null
  fees24h?: number | null
  revenue24h?: number | null
  interpretation: string
}

export type TendenciasDefiPanel = {
  totalTvlUsd: number | null
  tvlChange7dPct: number | null
  topChains: Array<{ name: string; tvlUsd: number }>
  topProtocols: TendenciasDefiProtocol[]
  summary: string
}

export type TendenciasTokenBuckets = {
  maisComentados: TendenciasTokenRow[]
  maisPositivos: TendenciasTokenRow[]
  maisNegativos: TendenciasTokenRow[]
  maiorVolume: TendenciasTokenRow[]
  acelerando: TendenciasTokenRow[]
  desacelerando: TendenciasTokenRow[]
  proximosUnlocks: Array<{
    symbol: string
    name: string
    geckoId: string | null
    unlockAt: number | null
    usdValue: number | null
  }>
  volumeAnormal: TendenciasTokenRow[]
  fundamentosFortes: TendenciasTokenRow[]
}

export type TendenciasMeta = {
  momentumPeriod: MomentumPeriod
  analysisTone: AnalysisTone
  engine: string
  dataSources: string[]
}

export type TendenciasApiResponse = {
  updatedAt: string
  meta: TendenciasMeta
  market: TendenciasMarketPanel
  observeToday: string
  news: TendenciasNewsInsight
  narratives: TendenciasNarrative[]
  buckets: TendenciasTokenBuckets
  defi: TendenciasDefiPanel
  alerts: TendenciasAlert[]
  partial: boolean
  error: string | null
}

export type TendenciasPrefs = {
  momentumPeriod: MomentumPeriod
  analysisTone: AnalysisTone
}

export const DEFAULT_TENDENCIAS_PREFS: TendenciasPrefs = {
  momentumPeriod: '7d',
  analysisTone: 'neutro',
}
