export type RebalanceInput = {
  price: number
  pMin: number
  pMax: number
  /** Multiplier on (Pmax - Pmin), typically 0.5–1.5 */
  aggressiveness: number
  smartMode: boolean
}

export type RebalanceResult = {
  newMin: number
  newMax: number
  rangeShiftPct: number
  inRange: boolean
  width: number
  effectiveWidth: number
  /** Mock IL % for display */
  impermanentLossHintPct: number
}

export function computeRebalance(input: RebalanceInput): RebalanceResult | null {
  const { price, pMin, pMax, aggressiveness, smartMode } = input
  if (!Number.isFinite(price) || !Number.isFinite(pMin) || !Number.isFinite(pMax)) return null
  if (!(pMax > pMin)) return null

  const width = pMax - pMin
  let effectiveWidth = width * aggressiveness
  if (smartMode) {
    effectiveWidth *= 1 + 0.12
  }

  const newMin = price - effectiveWidth / 2
  const newMax = price + effectiveWidth / 2

  const oldCenter = (pMin + pMax) / 2
  const newCenter = (newMin + newMax) / 2
  const rangeShiftPct =
    Math.abs(oldCenter) > 1e-12 ? ((newCenter - oldCenter) / Math.abs(oldCenter)) * 100 : 0

  const inRange = price >= pMin && price <= pMax

  const tightness = width / Math.max(price, 1e-12)
  const impermanentLossHintPct = Math.min(18, Math.max(0.1, tightness * 4.2 + (smartMode ? 1.2 : 0)))

  return {
    newMin,
    newMax,
    rangeShiftPct,
    inRange,
    width,
    effectiveWidth,
    impermanentLossHintPct,
  }
}
