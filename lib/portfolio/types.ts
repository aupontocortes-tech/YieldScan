export type PortfolioHolding = {
  id: string
  cmcId: number
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
}

export type CmcQuote = {
  price: number
  pct24h: number
  pct7d: number
  name: string
  cmcId: number
}
