export type PortfolioHolding = {
  id: string
  cmcId: number
  /** Id CoinGecko (ex.: bitcoin) — usado em /api/prices. Legado pode não ter. */
  geckoId?: string
  symbol: string
  name: string
  /** Thumb CoinGecko ou outro URL quando o PNG da CMC não carrega. */
  iconUrl?: string
  quantity: number
  avgBuyUsd: number
  firstBuyAt: string
}

export type PortfolioTransaction = {
  id: string
  type: 'buy' | 'sell'
  cmcId: number
  geckoId?: string
  symbol: string
  name: string
  quantity: number
  priceUsd: number
  at: string
  realizedPnlUsd?: number
  feeUsd?: number
  note?: string
}

export type PortfolioSnapshot = {
  t: number
  totalUsd: number
}

export type PortfolioData = {
  version: 1
  name: string
  holdings: PortfolioHolding[]
  transactions: PortfolioTransaction[]
  snapshots: PortfolioSnapshot[]
  realizedPnlUsd: number
  /** Meta de alocação (% da carteira, 0–100) por id da posição. */
  allocationTargetsPct?: Record<string, number>
}

export type CmcQuote = {
  price: number
  pct24h: number
  pct7d: number
  name: string
  geckoId?: string
  cmcId: number
}
