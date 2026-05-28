export type SentimentLevel = 'optimista' | 'neutro' | 'pessimista'

export type MomentumClass = 'acelerando' | 'estavel' | 'fraco' | 'reversao'

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
  volume24h: number | null
  marketCap: number | null
  sentiment: SentimentLevel
  aiScore: number
  momentum: MomentumClass
  momentumReason: string
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
  type:
    | 'volume'
    | 'sentimento'
    | 'mencoes'
    | 'momentum'
    | 'unlock'
    | 'tvl'
  title: string
  detail: string
  severity: 'info' | 'watch' | 'urgent'
  symbol?: string
}

export type TendenciasNewsInsight = {
  positivo: number
  neutro: number
  negativo: number
  topMentions: Array<{ symbol: string; count: number }>
  dominantNarrative: string | null
  headlines: Array<{
    titulo: string
    impacto: string
    categoria: string
    link: string
  }>
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

export type TendenciasApiResponse = {
  updatedAt: string
  market: TendenciasMarketPanel
  observeToday: string
  news: TendenciasNewsInsight
  narratives: TendenciasNarrative[]
  buckets: TendenciasTokenBuckets
  alerts: TendenciasAlert[]
  partial: boolean
  error: string | null
}
