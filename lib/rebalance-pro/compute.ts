export type RangeMode = 'simples' | 'dinamico'

/** `dual` = 50/50 centrado no preço; `single` = só o token dominante fora da faixa. */
export type DepositMode = 'dual' | 'single'

/** Token A = ativo cotado; token B = par (ex. ETH / USDC). */
export type DepositToken = 'token_a' | 'token_b'

export type OutOfRangeSide = 'below' | 'above' | 'in'

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
  depositMode?: DepositMode
  depositToken?: DepositToken
  /** Faixa inteiramente acima ou abaixo do preço (entrada single-sided Uniswap v3). */
  singleSidedPlacement?: 'above' | 'below'
}

export function getOutOfRangeSide(price: number, pMin: number, pMax: number): OutOfRangeSide {
  if (!Number.isFinite(price) || !Number.isFinite(pMin) || !Number.isFinite(pMax)) return 'in'
  if (price < pMin) return 'below'
  if (price > pMax) return 'above'
  return 'in'
}

/**
 * Fora da faixa: abaixo → 100% token A; acima → 100% token B (convenção ETH/USDC).
 */
export function inferDepositTokenWhenOutOfRange(
  price: number,
  pMin: number,
  pMax: number,
): DepositToken | null {
  const side = getOutOfRangeSide(price, pMin, pMax)
  if (side === 'below') return 'token_a'
  if (side === 'above') return 'token_b'
  return null
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

function resolveRangeWidth(
  P: number,
  pMin: number,
  pMax: number,
  modo: RangeMode,
  percentual?: number,
): number | null {
  if (!Number.isFinite(P) || P <= 0) return null
  if (!Number.isFinite(pMin) || !Number.isFinite(pMax) || !(pMax > pMin)) return null

  let range: number
  if (modo === 'simples') {
    range = pMax - pMin
  } else {
    const pct = percentual
    if (pct == null || !Number.isFinite(pct) || pct <= 0) return null
    range = P * pct
  }
  if (!(range > 0) || !Number.isFinite(range)) return null
  return range
}

/**
 * Entrada single-sided (estilo Uniswap v3):
 * - só token A → faixa inteira acima do preço atual [P, P+range]
 * - só token B → faixa inteira abaixo do preço atual [P-range, P]
 */
export function computeNewRangeSingleSided(input: {
  precoAtual: number
  precoMinAntigo: number
  precoMaxAntigo: number
  modo: RangeMode
  percentual?: number
  valorTotal?: number
  depositToken: DepositToken
}): NewRangeResult | null {
  const P = input.precoAtual
  const range = resolveRangeWidth(
    P,
    input.precoMinAntigo,
    input.precoMaxAntigo,
    input.modo,
    input.percentual,
  )
  if (range == null) return null

  let novoMin: number
  let novoMax: number
  let singleSidedPlacement: 'above' | 'below'

  if (input.depositToken === 'token_a') {
    novoMin = P
    novoMax = P + range
    singleSidedPlacement = 'above'
  } else {
    novoMin = Math.max(0, P - range)
    novoMax = P
    singleSidedPlacement = 'below'
  }

  const rangeUsado = novoMax - novoMin
  const out: NewRangeResult = {
    novoMin,
    novoMax,
    rangeUsado,
    depositMode: 'single',
    depositToken: input.depositToken,
    singleSidedPlacement,
  }

  const V = input.valorTotal
  if (V != null && Number.isFinite(V) && V > 0) {
    if (input.depositToken === 'token_a') {
      out.tokenA = V / P
      out.tokenB = 0
    } else {
      out.tokenA = 0
      out.tokenB = V
    }
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
  depositMode?: DepositMode
  /** Em `single`, usa este token; se omitido, infere pela posição fora da faixa. */
  depositToken?: DepositToken
}

export type RebalanceResult = {
  newMin: number
  newMax: number
  rangeUsado: number
  tokenA?: number
  tokenB?: number
  rangeShiftPct: number
  inRange: boolean
  outOfRangeSide: OutOfRangeSide
  depositMode: DepositMode
  depositToken?: DepositToken
  singleSidedPlacement?: 'above' | 'below'
  /** Largura da faixa antiga (Pmax - Pmin). */
  width: number
  /** Igual a `rangeUsado` (compat). */
  effectiveWidth: number
  impermanentLossHintPct: number
  /** Entrada single-sided evita swap imediato; IL futuro ainda possível se o preço entrar na faixa. */
  ilNoteKey: 'dual_active' | 'single_waiting' | 'single_in_range_unavailable'
}

function estimateIlHintPct(
  depositMode: DepositMode,
  rangeUsado: number,
  price: number,
  singleSidedPlacement?: 'above' | 'below',
): number {
  const tightness = rangeUsado / Math.max(price, 1e-12)
  if (depositMode === 'single') {
    // Fora do preço ativo: exposição a IL só quando o mercado cruza a faixa.
    return Math.min(12, Math.max(0.05, tightness * 2.1))
  }
  void singleSidedPlacement
  return Math.min(18, Math.max(0.1, tightness * 4.2))
}

export function computeRebalance(input: RebalanceInput): RebalanceResult | null {
  const depositMode = input.depositMode ?? 'dual'
  const outOfRangeSide = getOutOfRangeSide(input.price, input.pMin, input.pMax)
  const inferredToken = inferDepositTokenWhenOutOfRange(input.price, input.pMin, input.pMax)

  let nr: NewRangeResult | null = null
  let ilNoteKey: RebalanceResult['ilNoteKey'] = 'dual_active'

  if (depositMode === 'single') {
    const token = input.depositToken ?? inferredToken
    if (!token) {
      ilNoteKey = 'single_in_range_unavailable'
      nr = computeNewRange({
        precoAtual: input.price,
        precoMinAntigo: input.pMin,
        precoMaxAntigo: input.pMax,
        modo: input.modo,
        percentual: input.percentual,
        valorTotal: input.valorTotal,
      })
      if (nr) nr.depositMode = 'dual'
    } else {
      ilNoteKey = 'single_waiting'
      nr = computeNewRangeSingleSided({
        precoAtual: input.price,
        precoMinAntigo: input.pMin,
        precoMaxAntigo: input.pMax,
        modo: input.modo,
        percentual: input.percentual,
        valorTotal: input.valorTotal,
        depositToken: token,
      })
    }
  } else {
    nr = computeNewRange({
      precoAtual: input.price,
      precoMinAntigo: input.pMin,
      precoMaxAntigo: input.pMax,
      modo: input.modo,
      percentual: input.percentual,
      valorTotal: input.valorTotal,
    })
    if (nr) nr.depositMode = 'dual'
  }

  if (!nr) return null

  const width = input.pMax - input.pMin
  const oldCenter = (input.pMin + input.pMax) / 2
  const newCenter = (nr.novoMin + nr.novoMax) / 2
  const rangeShiftPct =
    Math.abs(oldCenter) > 1e-12 ? ((newCenter - oldCenter) / Math.abs(oldCenter)) * 100 : 0

  const inRange = outOfRangeSide === 'in'
  const effectiveDepositMode = nr.depositMode ?? depositMode
  const impermanentLossHintPct = estimateIlHintPct(
    effectiveDepositMode,
    nr.rangeUsado,
    input.price,
    nr.singleSidedPlacement,
  )

  return {
    newMin: nr.novoMin,
    newMax: nr.novoMax,
    rangeUsado: nr.rangeUsado,
    tokenA: nr.tokenA,
    tokenB: nr.tokenB,
    rangeShiftPct,
    inRange,
    outOfRangeSide,
    depositMode: effectiveDepositMode,
    depositToken: nr.depositToken,
    singleSidedPlacement: nr.singleSidedPlacement,
    width,
    effectiveWidth: nr.rangeUsado,
    impermanentLossHintPct,
    ilNoteKey,
  }
}
