/**
 * Modelo unificado de posição de liquidez (UI + camada de negócio).
 * Todos os valores monetários estão em USD quando aplicável.
 */
export type LiquidityChain = 'ethereum' | 'arbitrum' | 'base' | 'polygon' | 'bnb' | 'solana'

export type LiquidityPosition = {
  id: string
  chain: LiquidityChain
  protocol: string
  tokenA: string
  tokenB: string
  amountA: number
  amountB: number
  /** Valor de mercado atual estimado (principal + efeito de preço / IL). */
  valueUSD: number
  /** Estimativa do principal líquido depositado (tokens), em USD. */
  investedUSD: number
  feesEarnedUSD: number
  pnlUSD: number
  /** Percentual sobre investedUSD; NaN se investedUSD ~ 0. */
  pnlPct: number
  /** IL vs HODL ao preço atual; null se não houver dados de entrada. */
  impermanentLossUSD: number | null
  poolAddress?: string
  feeTierBps?: number

  // ---- Range / concentração (Uniswap v3 / CLMM) ----
  /** Posição está dentro do intervalo de preço activo. */
  inRange?: boolean
  tickLower?: number
  tickUpper?: number
  currentTick?: number
  /** Decimais do token A (token0 no contrato). */
  decimalsA?: number
  /** Decimais do token B (token1 no contrato). */
  decimalsB?: number
  /**
   * % (0-100) do valor total que está em tokenA.
   * 100 → toda a posição é tokenA (preço abaixo do range).
   * 0   → toda a posição é tokenB (preço acima do range).
   */
  tokenAValuePct?: number

  /**
   * APR anual estimado (pool), a partir de volume 24h / TVL no DexScreener × fee tier (aprox.).
   * Informativo, não garantido.
   */
  estimatedAprPct?: number

  /** `concentrated` = Uniswap v3 NFT; `lp_token` = mint SPL de LP (ex. Raydium). */
  positionKind?: 'concentrated' | 'lp_token'

  raw?: Record<string, unknown>
}

export type LiquidityFetchMeta = {
  source: string
  warning?: string
}

export type LiquidityPositionsResult = {
  positions: LiquidityPosition[]
  meta: LiquidityFetchMeta
}
