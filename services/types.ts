/**
 * Modelo único de posição para o dashboard (estilo DeBank / Zapper).
 * Todos os protocolos normalizam para este formato.
 */
export type AggregatorTokenLeg = {
  symbol: string
  amount: number
  usdValue: number
}

export type AggregatorRange = {
  /** Preço humano (token1 por token0), quando aplicável a CLMM / v3 */
  min: number
  max: number
  current: number
  /** (currentTick - tickLower) / (tickUpper - tickLower) × 100; fora do range pode ser &lt; 0 ou &gt; 100 */
  percentage: number
}

export type AggregatorLiquidityPosition = {
  id: string
  chain: string
  protocol: string

  token0: AggregatorTokenLeg
  token1: AggregatorTokenLeg

  totalValueUSD: number
  feesUSD: number
  apr: number

  inRange: boolean

  range: AggregatorRange

  /** P&amp;L % sobre principal estimado, quando existir */
  pnlPct?: number
  impermanentLossUSD?: number | null

  /** Metadados opcionais para explorers / links */
  poolAddress?: string
  feeTierBps?: number

  /** NFT CLMM Solana (Orca/Raydium) sem indexer — mostramos linha a $0 para não parecer “vazio”. */
  unpricedPlaceholder?: boolean
}

export type AggregatorFetchMeta = {
  warnings: string[]
  errors: { chain: string; message: string }[]
}
