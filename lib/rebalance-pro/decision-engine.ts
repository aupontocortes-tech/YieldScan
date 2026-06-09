import type { DepositToken, OutOfRangeSide } from '@/lib/rebalance-pro/compute'
import { inferDepositTokenWhenOutOfRange } from '@/lib/rebalance-pro/compute'

/**
 * Rebalance Pro — rule-based decision engine (no ML).
 * Tune thresholds here for product behaviour.
 */
export type MarketTrend = 'uptrend' | 'downtrend' | 'sideways'

/** Rótulos curtos para a UI (português). */
export function trendLabelPt(trend: MarketTrend): string {
  switch (trend) {
    case 'uptrend':
      return 'Alta'
    case 'downtrend':
      return 'Baixa'
    default:
      return 'Lateral'
  }
}

export type RecommendedAction = 'hold' | 'wait' | 'rebalance' | 'single_token_entry'

export const DECISION_THRESHOLDS = {
  /** Below this |24h %|, out-of-range positions get "Wait" (mean reversion bias). */
  waitMaxVolatilityPct: 3,
  /** From this |24h %| upward, "Rebalance" becomes eligible if trend is strong. */
  rebalanceMinVolatilityPct: 3,
  /** Above this |24h %|, prefer safer single-side / conservative framing. */
  highVolatilityPct: 8,
  /** |Return| over chart window ≥ this → "strong" trend for rebalance. */
  strongTrendMinAbsReturnPct: 2,
  /** Chart window: price move within ±this % is treated as sideways. */
  sidewaysBandPct: 0.4,
} as const

export type TrendAnalysis = {
  trend: MarketTrend
  /** Approximate return over the loaded history window (%). */
  windowReturnPct: number
  strongTrend: boolean
}

/**
 * `prices`: CoinGecko `market_chart.prices` as [ms, price][].
 */
export function analyzeTrendFromChart(prices: [number, number][]): TrendAnalysis {
  if (!prices.length || prices.length < 2) {
    return { trend: 'sideways', windowReturnPct: 0, strongTrend: false }
  }
  const first = prices[0]![1]
  const last = prices[prices.length - 1]![1]
  const windowReturnPct = first > 0 ? ((last - first) / first) * 100 : 0
  const { sidewaysBandPct, strongTrendMinAbsReturnPct } = DECISION_THRESHOLDS

  let trend: MarketTrend = 'sideways'
  if (windowReturnPct > sidewaysBandPct) trend = 'uptrend'
  else if (windowReturnPct < -sidewaysBandPct) trend = 'downtrend'

  const strongTrend = Math.abs(windowReturnPct) >= strongTrendMinAbsReturnPct

  return { trend, windowReturnPct, strongTrend }
}

export type DecisionInput = {
  inRange: boolean
  /** Use |usd_24h_change| from CoinGecko when available. */
  volatilityPct: number
  trendAnalysis: TrendAnalysis
  invalidRange: boolean
  /** Para sugerir entrada só com o token que a posição já detém. */
  price?: number
  pMin?: number
  pMax?: number
  tokenASymbol?: string
  tokenBSymbol?: string
}

export type DecisionOutput = {
  action: RecommendedAction
  title: string
  /** Texto completo (painel de detalhes). */
  message: string
  /** Máx. ~2 linhas — card principal do assistente. */
  summary: string
  ruleId: string
  outOfRangeSide?: OutOfRangeSide
  dominantToken?: DepositToken
  dominantTokenLabel?: string
}

/**
 * Priority-ordered rules — first match wins.
 */
function dominantTokenContext(input: DecisionInput): {
  side: OutOfRangeSide
  token: DepositToken | null
  label: string | undefined
} {
  const { price, pMin, pMax, tokenASymbol, tokenBSymbol } = input
  if (
    price == null ||
    pMin == null ||
    pMax == null ||
    !Number.isFinite(price) ||
    !(pMax > pMin)
  ) {
    return { side: 'in', token: null, label: undefined }
  }
  const token = inferDepositTokenWhenOutOfRange(price, pMin, pMax)
  const side: OutOfRangeSide =
    price < pMin ? 'below' : price > pMax ? 'above' : 'in'
  const label =
    token === 'token_a'
      ? tokenASymbol
      : token === 'token_b'
        ? tokenBSymbol
        : undefined
  return { side, token, label }
}

export function decideLiquidityAction(input: DecisionInput): DecisionOutput {
  const { inRange, volatilityPct, trendAnalysis, invalidRange } = input
  const { waitMaxVolatilityPct, highVolatilityPct, rebalanceMinVolatilityPct } = DECISION_THRESHOLDS
  const dominant = dominantTokenContext(input)

  const withDominant = (out: DecisionOutput): DecisionOutput => ({
    ...out,
    outOfRangeSide: dominant.side !== 'in' ? dominant.side : undefined,
    dominantToken: dominant.token ?? undefined,
    dominantTokenLabel: dominant.label,
  })

  if (invalidRange) {
    return {
      action: 'wait',
      title: 'Ajuste o intervalo',
      summary: 'O mínimo precisa ser menor que o máximo. Corrija para eu sugerir o próximo passo.',
      message:
        'O preço mínimo tem de ser menor que o máximo. Corrija isso para ver a sugestão ao lado.',
      ruleId: 'invalid_range',
    }
  }

  if (inRange) {
    return withDominant({
      action: 'hold',
      title: 'Manter posição',
      summary:
        'Tudo certo: o preço está na sua faixa e a posição segue gerando taxas. Sem necessidade de mexer agora.',
      message:
        'O preço está dentro da sua faixa: a posição está ativa e gerando taxas. Não precisa mudar o intervalo agora.',
      ruleId: 'in_range_hold',
    })
  }

  const tokenName = dominant.label ?? 'o token que você já tem'

  if (volatilityPct < waitMaxVolatilityPct) {
    return withDominant({
      action: 'wait',
      title: 'Esperar',
      summary:
        'O preço saiu pouco da faixa e a volatilidade está baixa. Muitas vezes vale esperar em vez de gastar taxa à toa.',
      message:
        'O preço saiu um pouco da faixa, mas a volatilidade nas últimas 24h é baixa. Muitas vezes o preço volta — evite gastar gas à toa.',
      ruleId: 'out_range_low_vol_wait',
    })
  }

  if (dominant.token && volatilityPct < rebalanceMinVolatilityPct + 2) {
    return withDominant({
      action: 'single_token_entry',
      title: 'Entrar só com 1 token',
      summary: `Fora da faixa: sua posição está em ${tokenName}. Pode reabrir só com ele, sem trocar metade para o outro ativo.`,
      message: `O preço saiu da faixa e a posição concentrou-se em ${tokenName}. No modo «Um token», a nova faixa fica do lado do preço — estilo ordem limite, sem swap 50/50.`,
      ruleId: 'out_range_single_dominant',
    })
  }

  if (volatilityPct >= highVolatilityPct) {
    return withDominant({
      action: 'single_token_entry',
      title: 'Entrar só com 1 token',
      summary: `Volatilidade alta: reforçar só com ${tokenName} costuma ser mais seguro que remontar 50/50 de uma vez.`,
      message:
        'Volatilidade alta nas últimas 24h. Entrar só com o token que você já detém evita um swap grande no momento errado.',
      ruleId: 'high_vol_single_side',
    })
  }

  if (volatilityPct >= rebalanceMinVolatilityPct && trendAnalysis.strongTrend) {
    return withDominant({
      action: 'rebalance',
      title: 'Rebalancear 50/50',
      summary:
        'Tendência forte: recentrar a faixa no preço atual com montagem 50/50 em valor.',
      message:
        'O mercado se moveu com tendência clara. No modo «Dois tokens», a faixa recentra no preço com metade em cada ativo.',
      ruleId: 'out_range_trend_rebalance',
    })
  }

  if (dominant.token) {
    return withDominant({
      action: 'single_token_entry',
      title: 'Entrar só com 1 token',
      summary: `Fora da faixa com ${tokenName} — reabrir só com esse ativo evita swap desnecessário.`,
      message: `Posição fora da faixa. Use o modo «Um token» para depositar apenas ${tokenName} numa faixa acima ou abaixo do preço.`,
      ruleId: 'out_range_default_single',
    })
  }

  return withDominant({
    action: 'wait',
    title: 'Esperar',
    summary:
      'Fora da faixa, mas o mercado ainda não mostrou uma tendência clara. Um pouco de paciência pode evitar decisão precipitada.',
    message:
      'Você está fora da faixa com volatilidade moderada, mas ainda sem tendência forte. Vale esperar confirmação antes de rebalancear.',
    ruleId: 'out_range_moderate_wait',
  })
}

export function actionDisplayLabel(action: RecommendedAction): string {
  switch (action) {
    case 'hold':
      return 'Manter posição'
    case 'wait':
      return 'Esperar'
    case 'rebalance':
      return 'Rebalancear 50/50'
    case 'single_token_entry':
      return 'Entrar só com 1 token'
    default:
      return '—'
  }
}

/** Explicação curta da regra (para utilizadores, não para debug). */
export function decisionRuleHintPt(ruleId: string): string {
  const map: Record<string, string> = {
    invalid_range: 'Intervalo de preços inválido.',
    in_range_hold: 'Preço dentro da faixa — posição ativa.',
    out_range_low_vol_wait: 'Fora da faixa, mas pouca volatilidade.',
    high_vol_single_side: 'Muita volatilidade — abordagem mais prudente.',
    out_range_single_dominant: 'Fora da faixa — posição em um token só.',
    out_range_default_single: 'Fora da faixa — entrada single-sided sugerida.',
    out_range_trend_rebalance: 'Fora da faixa com tendência marcada.',
    out_range_moderate_wait: 'Fora da faixa, mercado ainda indefinido.',
  }
  return map[ruleId] ?? `Critério: ${ruleId}`
}
