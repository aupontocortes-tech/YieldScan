export type SentimentLevel = 'optimista' | 'neutro' | 'pessimista'

export type MomentumClass = 'acelerando' | 'estavel' | 'fraco' | 'reversao'

export type MomentumPeriod = '7d' | '30d' | '90d'

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
  aiScore: number
  momentum: MomentumClass
  momentumLabel: string
  momentumReason: string
  strength: number
  mentionCount?: number
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
  type: 'volume' | 'sentimento' | 'mencoes' | 'momentum' | 'unlock' | 'tvl' | 'breakout'
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
}

export type TendenciasMeta = {
  momentumPeriod: MomentumPeriod
  analysisTone: AnalysisTone
  llmEnabled: boolean
  llmUsed: boolean
  fmpConfigured: boolean
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
  customPromptNote: string
  useLlm: boolean
}

export const DEFAULT_TENDENCIAS_PREFS: TendenciasPrefs = {
  momentumPeriod: '7d',
  analysisTone: 'neutro',
  customPromptNote: '',
  useLlm: true,
}
