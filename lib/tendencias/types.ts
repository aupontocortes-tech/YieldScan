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
  | 'layer1'
  | 'hacks'
  | 'institucionais'
  | 'rwa'
  | 'gaming'
  | 'restaking'
  | 'depin'
  | 'buybacks'
  | 'emprestimos'

export type TendenciasNarrativeSpotlight = {
  symbol: string
  name: string
  geckoId: string
  marketCap: number | null
  change24h: number | null
  change7d: number | null
  volume24h: number | null
  why: string
}

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
  id: TendenciasNarrativeId | string
  label: string
  summary: string
  impact: 'alto' | 'medio' | 'baixo'
  sentiment: SentimentLevel
  relatedSymbols: string[]
  mentionCount: number
  intensity: number
  /** 0–100: TVL + CoinGecko do sector */
  adoptionScore?: number
  /** 0–100: menções nas notícias */
  attentionScore?: number
  tvlUsd?: number | null
  tvlChange7dPct?: number | null
  marketCapChange24h?: number | null
  volume24h?: number | null
  source?: 'adocao' | 'atencao' | 'misto'
  simple?: string
  spotlights?: TendenciasNarrativeSpotlight[]
  /** Frase curta: porque está neste lugar do ranking. */
  rankWhy?: string
  topCoin?: {
    symbol: string
    name: string
    chain: string
    change7d: number | null
    geckoId: string | null
  } | null
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
  symbols: string[]
  stockSymbols: string[]
}

export type TendenciasNewsMention = {
  symbol: string
  count: number
  /** Variação % no período de momentum (referência; pode ser negativa). */
  changePct?: number | null
}

export type TendenciasNewsInsight = {
  positivo: number
  neutro: number
  negativo: number
  /** @deprecated alias de topCryptoMentions */
  topMentions: TendenciasNewsMention[]
  topCryptoMentions: TendenciasNewsMention[]
  topStockMentions: TendenciasNewsMention[]
  /** Período usado na variação de preço mostrada ao lado do ticker. */
  rankingPeriod?: MomentumPeriod
  dominantNarrative: string | null
  /** Manchetes diversificadas (vista por defeito). */
  headlines: TendenciasNewsHeadline[]
  /** Pool completo para o filtro “mais falados” (cripto/ação). */
  headlinesAll?: TendenciasNewsHeadline[]
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
  /** Tema mais falado nas notícias (pode diferir da adoção). */
  attentionNarrative?: string | null
  narrativeHint?: string | null
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

export type TendenciasL1Token = {
  name: string
  symbol: string
  geckoId: string | null
  protocol: string
  category: string
  narrative: string
  /** Nichos visíveis no cartão: DeFi, RWA, Recompra, IA… */
  niches: string[]
  tvlUsd: number
  change7d: number | null
  volume24h: number | null
  about: string
  url: string | null
  buyWatch: boolean
}

export type TendenciasNetworkRow = {
  name: string
  kind: 'l1' | 'l2' | 'outra'
  tvlUsd: number
  tvlChange7dPct: number | null
  tvlChange1dPct: number | null
  /** Dólares de TVL ganhos/perdidos em 7 dias (fluxo, não o cofre). */
  tvlFlow7dUsd: number | null
  volume24h: number | null
  nativeSymbol: string | null
  nativeGeckoId: string | null
  nativeChange7d: number | null
  /** Score antigo (tamanho). Preferir flowScore. */
  adoptionScore: number
  /** 0–100: desempenho = fluxo %, actividade e token nativo. Sem favorecer o maior cofre. */
  flowScore: number
  narratives: string[]
  tokens: TendenciasL1Token[]
}

export type TendenciasL1Watch = TendenciasL1Token & { chain: string }

export type TendenciasL1Panel = {
  summary: string
  /** L1 com melhor fluxo (não a maior em TVL). */
  bestL1: string | null
  /** L1 com o maior cofre (quase sempre Ethereum). */
  biggestVault: string | null
  newsNarrative: string | null
  networks: TendenciasNetworkRow[]
  buyWatch: TendenciasL1Watch[]
}

export type TendenciasEquityRow = {
  symbol: string
  name: string
  price: number | null
  changePct: number | null
  volume: number | null
  marketCap: number | null
  sectorTag: 'indice' | 'ia' | 'semis' | 'big-tech' | 'outro'
  /** Slug CoinGecko xStock, se existir no Mercado. */
  xstockId: string | null
}

export type TendenciasEquitiesPanel = {
  summary: string
  highlights: TendenciasEquityRow[]
  topVolume: TendenciasEquityRow[]
  aiWatchlist: TendenciasEquityRow[]
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
  l1: TendenciasL1Panel | null
  equities: TendenciasEquitiesPanel | null
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
