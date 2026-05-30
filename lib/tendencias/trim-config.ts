/** Pesos do score composto (soma = 1). */
export const TRIM_WEIGHTS = {
  momentum: 0.3,
  volume: 0.25,
  news: 0.2,
  defi: 0.15,
  relevance: 0.1,
} as const

export type TrimClass = 'fraco' | 'estavel' | 'forte' | 'acelerando'

export function trimClassFromScore(score: number): TrimClass {
  if (score >= 76) return 'acelerando'
  if (score >= 51) return 'forte'
  if (score >= 26) return 'estavel'
  return 'fraco'
}

export const TRIM_CLASS_LABEL: Record<TrimClass, string> = {
  fraco: 'Fraco',
  estavel: 'Estável',
  forte: 'Forte',
  acelerando: 'Acelerando',
}

/** Rótulos apresentados na UI (em vez do nome interno «TRIM»). */
export const SCORE_TENDENCIA_NOME = 'Score de Tendência'
export const SCORE_MERCADO_NOME = 'Score do mercado'
export const SCORE_TENDENCIA_FORMULA =
  'Score de Tendência = 30% momentum + 25% volume + 20% notícias + 15% DeFi + 10% relevância.'

export const POSITIVE_WORDS =
  /\b(bullish|growth|surge|breakout|partnership|expansion|adoption|record|approval|launch|rally|soars|gains|inflow|milestone|upgrade|integrat)\b/i

export const NEGATIVE_WORDS =
  /\b(hack|lawsuit|exploit|dump|decline|collapse|liquidation|ban|attack|selloff|breach|fraud|scam|rug|crackdown|outflow|delist)\b/i

export type TrimNarrativeId =
  | 'ia'
  | 'etfs'
  | 'memecoins'
  | 'defi'
  | 'stablecoins'
  | 'layer2'
  | 'regulacao'
  | 'institucionais'
  | 'rwa'
  | 'gaming'

export const TRIM_NARRATIVE_RULES: Array<{
  id: TrimNarrativeId
  label: string
  keywords: RegExp
  related: string[]
}> = [
  { id: 'ia', label: 'IA', keywords: /\bia\b|artificial intelligence|gpu|compute|agent|llm|openai|nvidia/i, related: ['RENDER', 'FET', 'TAO', 'NEAR'] },
  { id: 'etfs', label: 'ETFs', keywords: /\betf\b|blackrock|grayscale|spot etf|ibit|fidelity/i, related: ['BTC', 'ETH'] },
  { id: 'memecoins', label: 'Memecoins', keywords: /meme|doge|pepe|shib|wif|bonk|floki/i, related: ['DOGE', 'PEPE', 'SHIB', 'WIF'] },
  { id: 'defi', label: 'DeFi', keywords: /defi|dex|liquidity|yield|tvl|aave|uniswap|lending/i, related: ['UNI', 'AAVE', 'MKR', 'CRV'] },
  { id: 'stablecoins', label: 'Stablecoins', keywords: /stablecoin|usdt|usdc|tether|circle|depeg|dai\b/i, related: ['USDT', 'USDC', 'DAI'] },
  { id: 'layer2', label: 'Layer 2', keywords: /layer 2|l2|rollup|arbitrum|optimism|base chain|zk-|zksync/i, related: ['ARB', 'OP', 'MATIC', 'STRK'] },
  { id: 'regulacao', label: 'Regulamentação', keywords: /sec|cftc|regulat|compliance|mica|sanction|lawsuit/i, related: ['BTC', 'ETH'] },
  { id: 'institucionais', label: 'Institucionais', keywords: /institutional|microstrategy|treasury|sovereign|whale|inflow|blackrock/i, related: ['BTC', 'ETH'] },
  { id: 'rwa', label: 'RWA', keywords: /\brwa\b|real world asset|tokenized|treasury bill|ondo|centrifuge/i, related: ['ONDO', 'MKR', 'CFG'] },
  { id: 'gaming', label: 'Gaming', keywords: /gaming|gamefi|play-to-earn|metaverse|axie|immutable|ronin/i, related: ['IMX', 'AXS', 'GALA', 'SAND'] },
]

export const SYMBOL_FROM_NEWS =
  /\b(BTC|ETH|SOL|XRP|BNB|DOGE|ADA|AVAX|LINK|DOT|MATIC|POL|UNI|AAVE|ARB|OP|PEPE|SHIB|HYPE|RENDER|FET|TAO|NEAR|USDT|USDC|ONDO|IMX|SUI|APT|INJ|SEI|WIF|BONK)\b/gi
