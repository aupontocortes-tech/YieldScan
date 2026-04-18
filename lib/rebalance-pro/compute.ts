export type RangeMode = 'simples' | 'dinamico'

/** Entradas alinhadas ao assistente (preço = cotação do token A em USD). */
export type NewRangeInput = {
  precoAtual: number
  precoMinAntigo: number
  precoMaxAntigo: number
  modo: RangeMode
  /** Modo dinâmico: fração do preço (ex.: 0.1 = 10%). Ignorado em `simples`. */
  percentual?: number
  /** Se definido e > 0, calcula quantidades indicativas 50/50 em valor. */
  valorTotal?: number
}

export type NewRangeResult = {
  novoMin: number
  novoMax: number
  /** Largura final [novoMin, novoMax], após eventual ajuste para não cruzar zero. */
  rangeUsado: number
  tokenA?: number
  tokenB?: number
}

/**
 * Novo range centrado em `precoAtual`:
 * - simples: range = Pmax - Pmin
 * - dinamico: range = P × percentual
 * Se P - range/2 < 0, reduz a meia-largura para P (faixa [0, 2P], ainda centrada em P).
 */
export function computeNewRange(input: NewRangeInput): NewRangeResult | null {
  const P = input.precoAtual
  const pMin = input.precoMinAntigo
  const pMax = input.precoMaxAntigo

  if (!Number.isFinite(P) || P <= 0) return null
  if (!Number.isFinite(pMin) || !Number.isFinite(pMax) || !(pMax > pMin) || pMin < 0 || pMax < 0) return null

  let range: number
  if (input.modo === 'simples') {
    range = pMax - pMin
  } else {
    const pct = input.percentual
    if (pct == null || !Number.isFinite(pct) || pct <= 0) return null
    range = P * pct
  }

  if (!(range > 0) || !Number.isFinite(range)) return null

  let metade = range / 2
  if (P - metade < 0) {
    metade = P
  }

  const novoMin = P - metade
  const novoMax = P + metade
  const rangeUsado = novoMax - novoMin

  const out: NewRangeResult = { novoMin, novoMax, rangeUsado }

  const V = input.valorTotal
  if (V != null && Number.isFinite(V) && V > 0) {
    const metadeValor = V / 2
    out.tokenA = metadeValor / P
    out.tokenB = metadeValor
  }

  return out
}

export type RebalanceInput = {
  price: number
  pMin: number
  pMax: number
  modo: RangeMode
  percentual?: number
  valorTotal?: number
}

export type RebalanceResult = {
  newMin: number
  newMax: number
  rangeUsado: number
  tokenA?: number
  tokenB?: number
  rangeShiftPct: number
  inRange: boolean
  /** Largura da faixa antiga (Pmax - Pmin). */
  width: number
  /** Igual a `rangeUsado` (compat). */
  effectiveWidth: number
  impermanentLossHintPct: number
}

export function computeRebalance(input: RebalanceInput): RebalanceResult | null {
  const nr = computeNewRange({
    precoAtual: input.price,
    precoMinAntigo: input.pMin,
    precoMaxAntigo: input.pMax,
    modo: input.modo,
    percentual: input.percentual,
    valorTotal: input.valorTotal,
  })
  if (!nr) return null

  const width = input.pMax - input.pMin
  const oldCenter = (input.pMin + input.pMax) / 2
  const newCenter = (nr.novoMin + nr.novoMax) / 2
  const rangeShiftPct =
    Math.abs(oldCenter) > 1e-12 ? ((newCenter - oldCenter) / Math.abs(oldCenter)) * 100 : 0

  const inRange = input.price >= input.pMin && input.price <= input.pMax
  const tightness = nr.rangeUsado / Math.max(input.price, 1e-12)
  const impermanentLossHintPct = Math.min(18, Math.max(0.1, tightness * 4.2))

  return {
    newMin: nr.novoMin,
    newMax: nr.novoMax,
    rangeUsado: nr.rangeUsado,
    tokenA: nr.tokenA,
    tokenB: nr.tokenB,
    rangeShiftPct,
    inRange,
    width,
    effectiveWidth: nr.rangeUsado,
    impermanentLossHintPct,
  }
}
