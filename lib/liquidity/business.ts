import type { LiquidityPosition } from '@/lib/liquidity/types'

export type PositionValueInput = Pick<
  LiquidityPosition,
  'amountA' | 'amountB' | 'tokenA' | 'tokenB'
> & {
  priceA_USD: number
  priceB_USD: number
}

/**
 * Valor de mercado atual da posição a partir de quantidades e preços spot.
 */
export function calculatePositionValue(input: PositionValueInput): number {
  const a = Math.max(0, input.amountA) * (Number.isFinite(input.priceA_USD) ? input.priceA_USD : 0)
  const b = Math.max(0, input.amountB) * (Number.isFinite(input.priceB_USD) ? input.priceB_USD : 0)
  return a + b
}

export type PnLInput = {
  valueUSD: number
  investedUSD: number
  feesEarnedUSD: number
}

/**
 * Lucro/prejuízo em USD: valor atual menos principal, fees tratadas separadamente na UI.
 */
export function calculatePnL(input: PnLInput): number {
  return input.valueUSD - input.investedUSD
}

export type ImpermanentLossInput = {
  /** Quantidades atuais na posição */
  amountA: number
  amountB: number
  /** Preços spot atuais */
  priceA_USD: number
  priceB_USD: number
  /** Quantidades no momento da entrada (aproximação) */
  entryAmountA: number
  entryAmountB: number
  /** Preços na entrada (USD) — se ausentes, retorna null */
  entryPriceA_USD: number | null
  entryPriceB_USD: number | null
}

/**
 * IL vs HODL: valor hodl no preço atual menos valor na pool.
 * Requer preços de entrada; caso contrário null (dados insuficientes).
 */
export function calculateImpermanentLoss(input: ImpermanentLossInput): number | null {
  const { entryPriceA_USD, entryPriceB_USD } = input
  if (
    entryPriceA_USD == null ||
    entryPriceB_USD == null ||
    !Number.isFinite(entryPriceA_USD) ||
    !Number.isFinite(entryPriceB_USD) ||
    entryPriceA_USD <= 0 ||
    entryPriceB_USD <= 0
  ) {
    return null
  }
  const hodlUSD =
    input.entryAmountA * input.priceA_USD + input.entryAmountB * input.priceB_USD
  const poolUSD = calculatePositionValue({
    amountA: input.amountA,
    amountB: input.amountB,
    tokenA: '',
    tokenB: '',
    priceA_USD: input.priceA_USD,
    priceB_USD: input.priceB_USD,
  })
  return poolUSD - hodlUSD
}

export function pnlPercent(pnlUSD: number, investedUSD: number): number {
  if (!Number.isFinite(investedUSD) || investedUSD < 1e-8) return Number.NaN
  return (pnlUSD / investedUSD) * 100
}
