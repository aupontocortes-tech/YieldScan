/**
 * Radar de Tendência — 12 componentes institucionais:
 * RSI, ADX, MACD, Volume, HTF, POC, Projeção, EMA20/50/200, ATR, VWAP.
 *
 * Regras de sinal:
 * - BUY só com confirmação multi-timeframe e alinhamento de tendência (ou reversão estrita).
 * - Nunca BUY em queda confirmada (EMA20 < EMA50, preço abaixo das médias, HTF em queda).
 */

import { buildBacktestFromTrades, evaluateTradePnl, tpSlFromAtr } from '@/lib/btc/signal-system/backtest'
import { DEFAULT_SIGNAL_PARAMS, ROUND_TRIP_COST_PCT } from '@/lib/btc/signal-system/constants'
import type { SignalBacktestResult, SignalEngineParams, SignalOptimizationResult } from '@/lib/btc/signal-system/types'
import { atr, ema, macd, rollingVwap, rsi, sma } from '@/lib/btc/indicators'
import type { OhlcvBar } from '@/lib/btc/types'

export type { SignalEngineParams, SignalBacktestResult, SignalOptimizationResult }

export type TrendRadarSignalType = 'buy' | 'sell' | 'none'

export type TrendRadarMarker = {
  time: number
  type: 'buy' | 'sell'
  price: number
  score: number
}

export type TrendRadarStrength = 'muito_forte' | 'forte' | 'moderado' | 'fraco'

export type TrendRegime = 'bull' | 'bear' | 'neutral'

export type TrendRadarAnalysis = {
  signal: TrendRadarSignalType
  score: number
  strength: TrendRadarStrength
  strengthLabel: string
  qualityLabel: string
  probabilityPct: number
  confidencePct: number
  direction: 'alta' | 'baixa' | 'lateral'
  /** Leitura assertiva: para onde o mercado aponta. */
  marketBias: 'alta' | 'baixa' | 'lateral'
  /** Tendência curta EMA9 vs EMA21 (como no vídeo / market-card). */
  emaTrend: 'alta' | 'baixa' | 'lateral'
  marketCall: string
  assertivenessPct: number
  bullVotes: number
  bearVotes: number
  regime: TrendRegime
  trendForcePct: number
  takeProfit: number | null
  stopLoss: number | null
  rsi: number | null
  adx: number | null
  macdHist: number | null
  macdCross: 'bullish' | 'bearish' | 'none'
  volumeRatio: number | null
  htfTrend: 'alta' | 'baixa' | 'lateral'
  htfConfirmed: boolean
  poc: number | null
  pocRelation: 'above' | 'below' | 'at'
  projection: 'alta' | 'baixa' | 'lateral'
  ema20: number | null
  ema50: number | null
  ema200: number | null
  vwap: number | null
  atr: number | null
  markers: TrendRadarMarker[]
  divergence: 'alta' | 'baixa' | 'nenhuma'
  projectedPrice: number | null
  htfLabel: string
  chartLabel: string
  criteria: {
    rsi: boolean
    adx: boolean
    macd: boolean
    ema20: boolean
    ema50: boolean
    ema200: boolean
    volume: boolean
    htf: boolean
    poc: boolean
    projection: boolean
    vwap: boolean
    atr: boolean
    divergence: boolean
  }
  display: {
    volume: string
    macd: string
    htf: string
    rsi: string
    projection: string
    vwap: string
    ema: string
  }
  /** Checklist — cada item mostra se confirma a direção ativa. */
  checklist: {
    direction: 'buy' | 'sell' | 'wait'
    directionLabel: string
    confirmed: number
    total: number
    coreConfirmed: number
    coreTotal: number
    ready: boolean
    missing: string[]
    items: Array<{
      id: string
      label: string
      value: string
      ok: boolean
      core?: boolean
    }>
  }
  /** Backtest matemático em todo o histórico do gráfico (TP/SL via ATR). */
  historicalAccuracy: {
    winRatePct: number
    wins: number
    losses: number
    total: number
    horizonBars: number
    chartBars: number
  }
  /** Métricas completas de backtest (lucro, drawdown). */
  backtest: SignalBacktestResult
  /** Parâmetros ativos e otimização (quando aplicada). */
  engineParams: SignalEngineParams
  optimization: SignalOptimizationResult | null
}

const POC_BINS = 32
const MIN_BARS = 55

function resolveParams(params?: Partial<SignalEngineParams>): SignalEngineParams {
  return { ...DEFAULT_SIGNAL_PARAMS, ...params }
}

export function getHigherTimeframeId(currentId: string): string {
  const map: Record<string, string> = {
    '1m': '15m',
    '5m': '1h',
    '15m': '4h',
    '1h': '1d',
    '4h': '1d',
    '1d': '1w',
    '1w': '1M',
    '1M': '1M',
    '2mo': '1w',
    '3mo': '1w',
    '6mo': '1w',
    '1y': '1M',
    '3y': '1M',
  }
  return map[currentId] ?? '1d'
}

/** ADX Wilder (14). */
export function adx(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): (number | null)[] {
  const n = closes.length
  const out: (number | null)[] = Array(n).fill(null)
  if (n < period * 2 + 1) return out

  const tr: number[] = []
  const plusDm: number[] = []
  const minusDm: number[] = []

  for (let i = 0; i < n; i++) {
    if (i === 0) {
      tr.push(highs[i]! - lows[i]!)
      plusDm.push(0)
      minusDm.push(0)
      continue
    }
    const up = highs[i]! - highs[i - 1]!
    const down = lows[i - 1]! - lows[i]!
    plusDm.push(up > down && up > 0 ? up : 0)
    minusDm.push(down > up && down > 0 ? down : 0)
    tr.push(
      Math.max(
        highs[i]! - lows[i]!,
        Math.abs(highs[i]! - closes[i - 1]!),
        Math.abs(lows[i]! - closes[i - 1]!),
      ),
    )
  }

  let atrSmooth = 0
  let sp = 0
  let sm = 0
  for (let i = 1; i <= period; i++) {
    atrSmooth += tr[i]!
    sp += plusDm[i]!
    sm += minusDm[i]!
  }
  atrSmooth /= period
  sp /= period
  sm /= period

  const dxAt = (a: number, p: number, m: number): number => {
    if (a <= 0) return 0
    const dip = (100 * p) / a
    const dim = (100 * m) / a
    const s = dip + dim
    return s <= 0 ? 0 : (100 * Math.abs(dip - dim)) / s
  }

  let adxSmooth = dxAt(atrSmooth, sp, sm)
  out[period] = adxSmooth

  for (let i = period + 1; i < n; i++) {
    atrSmooth = (atrSmooth * (period - 1) + tr[i]!) / period
    sp = (sp * (period - 1) + plusDm[i]!) / period
    sm = (sm * (period - 1) + minusDm[i]!) / period
    const dx = dxAt(atrSmooth, sp, sm)
    adxSmooth = (adxSmooth * (period - 1) + dx) / period
    out[i] = adxSmooth
  }
  return out
}

export function computePoc(bars: OhlcvBar[], lookback = 60, bins = POC_BINS): number | null {
  if (bars.length < 10) return null
  const slice = bars.slice(-lookback)
  let lo = Infinity
  let hi = -Infinity
  for (const b of slice) {
    lo = Math.min(lo, b.low)
    hi = Math.max(hi, b.high)
  }
  if (!(hi > lo)) return slice[slice.length - 1]?.close ?? null

  const volBins = Array(bins).fill(0)
  const step = (hi - lo) / bins
  for (const b of slice) {
    const tp = (b.high + b.low + b.close) / 3
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((tp - lo) / step)))
    volBins[idx] += b.volume > 0 ? b.volume : 1
  }
  let maxIdx = 0
  for (let i = 1; i < bins; i++) {
    if (volBins[i] > volBins[maxIdx]) maxIdx = i
  }
  return lo + (maxIdx + 0.5) * step
}

function strengthFromScore(score: number): { strength: TrendRadarStrength; label: string; qualityLabel: string } {
  if (score >= 88) return { strength: 'muito_forte', label: 'Sinal muito forte', qualityLabel: 'MUITO FORTE' }
  if (score >= 76) return { strength: 'forte', label: 'Sinal forte', qualityLabel: 'FORTE' }
  if (score >= 68) return { strength: 'moderado', label: 'Sinal moderado', qualityLabel: 'MODERADO' }
  return { strength: 'fraco', label: 'Não operar', qualityLabel: 'NÃO OPERAR' }
}

function htfTrendAtTime(htfBars: OhlcvBar[] | undefined, time: number): 'alta' | 'baixa' | 'lateral' {
  if (!htfBars || htfBars.length < 25) return 'lateral'
  let end = 0
  for (let i = 0; i < htfBars.length; i++) {
    if (htfBars[i]!.time <= time) end = i
    else break
  }
  return htfTrendFromBars(htfBars.slice(0, end + 1))
}

function pocAtIndex(bars: OhlcvBar[], index: number, lookback: number): number | null {
  const start = Math.max(0, index - lookback + 1)
  return computePoc(bars.slice(start, index + 1), lookback, POC_BINS)
}

function htfTrendFromBars(htfBars: OhlcvBar[] | undefined): 'alta' | 'baixa' | 'lateral' {
  if (!htfBars || htfBars.length < 25) return 'lateral'
  const closes = htfBars.map((b) => b.close)
  const e20 = ema(closes, 20)
  const e50 = ema(closes, 50)
  const i = closes.length - 1
  const a = e20[i]
  const b = e50[i]
  const price = closes[i]!
  if (a == null || b == null) return 'lateral'
  const diff = ((a - b) / Math.max(b, 1e-12)) * 100
  if (diff > 0.2 && price > a) return 'alta'
  if (diff < -0.2 && price < a) return 'baixa'
  return 'lateral'
}

type BarMetrics = {
  rsi: number | null
  rsiPrev: number | null
  adx: number | null
  macdHist: number | null
  macdCross: 'bullish' | 'bearish' | 'none'
  ema20: number | null
  ema50: number | null
  ema200: number | null
  ema9: number | null
  ema21: number | null
  ema20Prev: number | null
  volRatio: number | null
  volume: number
  poc: number | null
  htf: 'alta' | 'baixa' | 'lateral'
  vwap: number | null
  atr: number | null
  projection: 'alta' | 'baixa' | 'lateral'
  close: number
  open: number
}

function projectionAt(
  ema20S: (number | null)[],
  macdHist: number | null,
  i: number,
): 'alta' | 'baixa' | 'lateral' {
  const e = ema20S[i]
  const e5 = i >= 5 ? ema20S[i - 5] : null
  if (e == null || e5 == null || e5 === 0) return 'lateral'
  const slopePct = ((e - e5) / e5) * 100
  if (slopePct > 0.25 && (macdHist ?? 0) > 0) return 'alta'
  if (slopePct < -0.25 && (macdHist ?? 0) < 0) return 'baixa'
  return 'lateral'
}

function metricsAtIndex(
  i: number,
  bars: OhlcvBar[],
  rsiS: (number | null)[],
  adxS: (number | null)[],
  macdOut: ReturnType<typeof macd>,
  ema20S: (number | null)[],
  ema50S: (number | null)[],
  ema200S: (number | null)[],
  ema9S: (number | null)[],
  ema21S: (number | null)[],
  volSma: (number | null)[],
  vwapS: (number | null)[],
  atrS: (number | null)[],
  poc: number | null,
  htf: 'alta' | 'baixa' | 'lateral',
): BarMetrics {
  const prevMacd = i > 0 ? macdOut.hist[i - 1] : null
  const curMacd = macdOut.hist[i]
  let macdCross: BarMetrics['macdCross'] = 'none'
  if (prevMacd != null && curMacd != null) {
    if (prevMacd <= 0 && curMacd > 0) macdCross = 'bullish'
    else if (prevMacd >= 0 && curMacd < 0) macdCross = 'bearish'
  }

  const vol = bars[i]?.volume ?? 0
  const volAvg = volSma[i]
  const volRatio = volAvg != null && volAvg > 0 ? vol / volAvg : null

  return {
    rsi: rsiS[i] ?? null,
    rsiPrev: i > 0 ? (rsiS[i - 1] ?? null) : null,
    adx: adxS[i] ?? null,
    macdHist: curMacd ?? null,
    macdCross,
    ema20: ema20S[i] ?? null,
    ema50: ema50S[i] ?? null,
    ema200: ema200S[i] ?? null,
    ema9: ema9S[i] ?? null,
    ema21: ema21S[i] ?? null,
    ema20Prev: i > 0 ? (ema20S[i - 1] ?? null) : null,
    volRatio,
    volume: vol,
    poc,
    htf,
    vwap: vwapS[i] ?? null,
    atr: atrS[i] ?? null,
    projection: projectionAt(ema20S, curMacd ?? null, i),
    close: bars[i]?.close ?? 0,
    open: bars[i]?.open ?? 0,
  }
}

function shortTrend(m: BarMetrics): 'alta' | 'baixa' | 'lateral' {
  if (m.ema9 == null || m.ema21 == null) return 'lateral'
  if (m.ema9 > m.ema21) return 'alta'
  if (m.ema9 < m.ema21) return 'baixa'
  return 'lateral'
}

function regimeAt(m: BarMetrics, price: number): TrendRegime {
  const st = shortTrend(m)
  if (st === 'alta' && m.ema20 != null && price > m.ema20) return 'bull'
  if (st === 'baixa' && m.ema20 != null && price < m.ema20) return 'bear'

  const { ema20, ema50, ema200 } = m
  if (ema20 == null || ema50 == null) return 'neutral'

  if (ema200 != null) {
    if (price > ema20 && ema20 > ema50 && ema50 > ema200) return 'bull'
    if (price < ema20 && ema20 < ema50 && ema50 < ema200) return 'bear'
  } else {
    if (price > ema20 && ema20 > ema50) return 'bull'
    if (price < ema20 && ema20 < ema50) return 'bear'
  }
  return 'neutral'
}

function coreBuyHits(m: BarMetrics): number {
  let hits = 0
  const r = m.rsi
  if (r != null && r >= 38 && r <= 58) hits++
  else if (r != null && r < 38 && m.rsiPrev != null && r > m.rsiPrev) hits++

  if (m.adx != null && m.adx >= 22) hits++
  if (m.macdCross === 'bullish' || (m.macdHist != null && m.macdHist > 0)) hits++
  if (m.volRatio != null && m.volRatio >= 1) hits++
  if (m.htf === 'alta') hits++
  return hits
}

function coreSellHits(m: BarMetrics): number {
  let hits = 0
  const r = m.rsi
  // Venda em topos: RSI elevado ou a cair de zona alta (não exige RSI>58 em queda estrutural)
  if (r != null && r >= 50) hits++
  else if (r != null && m.rsiPrev != null && r < m.rsiPrev && r >= 38) hits++

  if (m.adx != null && m.adx >= 20) hits++
  if (m.macdCross === 'bearish' || (m.macdHist != null && m.macdHist < 0)) hits++
  if (m.volRatio != null && m.volRatio >= 0.9) hits++
  if (m.htf === 'baixa' || m.htf === 'lateral') hits++
  return hits
}

function isStrictReversalBuy(m: BarMetrics, price: number, regime: TrendRegime): boolean {
  if (regime !== 'bear' && regime !== 'neutral') return false
  if (m.htf === 'baixa') return false
  if (m.macdCross !== 'bullish') return false
  if (m.rsi == null || m.rsi >= 40) return false
  if (m.rsiPrev == null || m.rsi <= m.rsiPrev) return false
  if (m.volRatio == null || m.volRatio < 1.15) return false
  if (m.ema20 == null || price < m.ema20 * 0.995) return false
  if (m.close <= m.open) return false
  return coreBuyHits(m) >= 3
}

function canBuy(m: BarMetrics, price: number, regime: TrendRegime): boolean {
  const core = coreBuyHits(m)
  if (m.htf === 'baixa') return false

  if (regime === 'bear') {
    return isStrictReversalBuy(m, price, regime)
  }

  if (regime === 'bull') {
    return (
      core >= 4 &&
      m.htf === 'alta' &&
      m.ema20 != null &&
      m.ema50 != null &&
      m.ema20 >= m.ema50 &&
      price >= m.ema20 * 0.998 &&
      (m.vwap == null || price >= m.vwap * 0.997) &&
      m.projection !== 'baixa'
    )
  }

  return (
    core >= 4 &&
    m.macdCross === 'bullish' &&
    m.ema20 != null &&
    m.ema50 != null &&
    m.ema20 >= m.ema50 &&
    price > m.ema50 &&
    m.htf !== 'baixa'
  )
}

function canSell(m: BarMetrics, price: number, regime: TrendRegime): boolean {
  const core = coreSellHits(m)
  // Bloqueia venda só em alta forte confirmada (HTF + regime bull)
  if (m.htf === 'alta' && regime === 'bull') return false

  if (regime === 'bull') {
    return (
      core >= 3 &&
      m.macdCross === 'bearish' &&
      m.rsi != null &&
      m.rsi >= 55 &&
      m.htf !== 'alta'
    )
  }

  if (regime === 'bear') {
    const bearMomentum =
      m.macdCross === 'bearish' || (m.macdHist != null && m.macdHist < 0) || m.projection === 'baixa'
    const shortBear = m.ema9 != null && m.ema21 != null && m.ema9 < m.ema21
    return (
      core >= 2 &&
      bearMomentum &&
      shortBear &&
      m.ema20 != null &&
      m.ema50 != null &&
      m.ema20 <= m.ema50 &&
      price <= m.ema50 * 1.01
    )
  }

  return (
    core >= 3 &&
    m.ema20 != null &&
    m.ema50 != null &&
    m.ema20 <= m.ema50 &&
    (m.macdCross === 'bearish' || (m.macdHist != null && m.macdHist < 0)) &&
    m.htf !== 'alta'
  )
}

export type TrendRadarOptions = {
  htfLabel?: string
  chartLabel?: string
  params?: Partial<SignalEngineParams>
  optimization?: SignalOptimizationResult | null
  skipMarkersLimit?: boolean
  /** Conta apenas operações cuja entrada ocorre a partir deste índice (validação fora da amostra). */
  backtestStartIndex?: number
}

function countConfluence(criteria: TrendRadarAnalysis['criteria']): number {
  const { divergence: _d, ...main } = criteria
  return Object.values(main).filter(Boolean).length
}

function detectRsiDivergence(
  bars: OhlcvBar[],
  rsiS: (number | null)[],
  lookback = 24,
): 'bullish' | 'bearish' | 'none' {
  const end = bars.length - 1
  if (end < lookback + 2) return 'none'
  const start = end - lookback
  const mid = start + Math.floor(lookback / 2)

  let lowPrice1 = Infinity
  let lowPrice2 = Infinity
  let lowRsi1: number | null = null
  let lowRsi2: number | null = null
  let highPrice1 = -Infinity
  let highPrice2 = -Infinity
  let highRsi1: number | null = null
  let highRsi2: number | null = null

  for (let i = start; i < mid; i++) {
    const c = bars[i]!.close
    const r = rsiS[i]
    if (c < lowPrice1) {
      lowPrice1 = c
      lowRsi1 = r
    }
    if (c > highPrice1) {
      highPrice1 = c
      highRsi1 = r
    }
  }
  for (let i = mid; i <= end; i++) {
    const c = bars[i]!.close
    const r = rsiS[i]
    if (c < lowPrice2) {
      lowPrice2 = c
      lowRsi2 = r
    }
    if (c > highPrice2) {
      highPrice2 = c
      highRsi2 = r
    }
  }

  if (
    lowRsi1 != null &&
    lowRsi2 != null &&
    lowPrice2 < lowPrice1 * 0.998 &&
    lowRsi2 > lowRsi1 + 1.5
  ) {
    return 'bullish'
  }
  if (
    highRsi1 != null &&
    highRsi2 != null &&
    highPrice2 > highPrice1 * 1.002 &&
    highRsi2 < highRsi1 - 1.5
  ) {
    return 'bearish'
  }
  return 'none'
}

function projectedPriceAt(m: BarMetrics, price: number): number | null {
  if (m.ema20 == null || m.ema20Prev == null || m.atr == null) return null
  const slope = m.ema20 - m.ema20Prev
  const barsAhead = 5
  const raw = price + slope * barsAhead
  if (m.projection === 'alta') return raw + m.atr * 0.5
  if (m.projection === 'baixa') return raw - m.atr * 0.5
  return raw
}

function evaluateCriteria(
  m: BarMetrics,
  price: number,
  direction: 'buy' | 'sell',
  regime: TrendRegime,
  divergence: 'bullish' | 'bearish' | 'none',
  signalActive: boolean,
  params: SignalEngineParams,
): TrendRadarAnalysis['criteria'] {
  const r = m.rsi
  const rsi =
    direction === 'buy'
      ? r != null && ((r >= 38 && r <= 58) || (r < 38 && m.rsiPrev != null && r > m.rsiPrev))
      : r != null && r >= 45

  const adx = m.adx != null && m.adx >= params.adxMin

  const macd =
    direction === 'buy'
      ? m.macdCross === 'bullish' || (m.macdHist != null && m.macdHist > 0)
      : m.macdCross === 'bearish' || (m.macdHist != null && m.macdHist < 0)

  const volume = m.volRatio != null && m.volRatio >= 0.95

  const htf =
    direction === 'buy'
      ? m.htf === 'alta' || (m.htf === 'lateral' && regime !== 'bear')
      : m.htf === 'baixa' || (m.htf === 'lateral' && regime === 'bear')

  let poc = false
  if (m.poc != null && m.poc > 0) {
    const rel = price / m.poc
    poc = direction === 'buy' ? rel >= 0.998 : rel <= 1.002
  }

  const projection =
    direction === 'buy' ? m.projection !== 'baixa' : m.projection !== 'alta'

  const ema20 =
    m.ema20 != null &&
    (direction === 'buy' ? price >= m.ema20 * 0.997 : price <= m.ema20 * 1.003)

  const ema50 =
    m.ema20 != null &&
    m.ema50 != null &&
    (direction === 'buy' ? m.ema20 >= m.ema50 : m.ema20 <= m.ema50)

  const ema200 =
    m.ema200 != null &&
    (direction === 'buy' ? price > m.ema200 : price < m.ema200)

  const vwap =
    m.vwap != null &&
    (direction === 'buy' ? price >= m.vwap * 0.998 : price <= m.vwap * 1.002)

  const atr = m.atr != null && m.atr > 0 && signalActive

  const divergenceOk =
    direction === 'buy' ? divergence === 'bullish' : divergence === 'bearish'

  return { rsi, adx, macd, ema20, ema50, ema200, volume, htf, poc, projection, vwap, atr, divergence: divergenceOk }
}

function scoreFromCriteria(c: TrendRadarAnalysis['criteria']): number {
  const weights: Array<[boolean, number]> = [
    [c.rsi, 10],
    [c.adx, 10],
    [c.macd, 12],
    [c.volume, 10],
    [c.htf, 12],
    [c.poc, 6],
    [c.projection, 8],
    [c.ema20, 6],
    [c.ema50, 6],
    [c.ema200, 6],
    [c.vwap, 8],
    [c.atr, 4],
    [c.divergence, 6],
  ]
  let score = 0
  for (const [ok, w] of weights) if (ok) score += w
  return Math.max(0, Math.min(100, Math.round(score)))
}

function scoreBar(
  m: BarMetrics,
  price: number,
  direction: 'buy' | 'sell',
  regime: TrendRegime,
  divergence: 'bullish' | 'bearish' | 'none',
  params: SignalEngineParams,
  signalActive = false,
): { score: number; criteria: TrendRadarAnalysis['criteria'] } {
  const criteria = evaluateCriteria(m, price, direction, regime, divergence, signalActive, params)
  return { score: scoreFromCriteria(criteria), criteria }
}

function buildDisplayLabels(m: BarMetrics, price: number): TrendRadarAnalysis['display'] {
  const vol =
    m.volRatio == null
      ? '—'
      : m.volRatio >= 1.2
        ? 'FORTE'
        : m.volRatio >= 0.9
          ? 'MÉDIO'
          : 'FRACO'

  let macd = 'NEUTRO'
  if (m.macdCross === 'bullish' || (m.macdHist != null && m.macdHist > 0)) macd = 'ALTA'
  else if (m.macdCross === 'bearish' || (m.macdHist != null && m.macdHist < 0)) macd = 'BAIXA'

  const htf = m.htf === 'alta' ? 'ALTA' : m.htf === 'baixa' ? 'QUEDA' : 'LATERAL'

  const rsi =
    m.rsi == null
      ? '—'
      : m.rsi < 35
        ? 'SOBREVENDA'
        : m.rsi > 65
          ? 'SOBRECOMPRA'
          : m.rsi.toFixed(1)

  const projection =
    m.projection === 'alta' ? 'ALTA' : m.projection === 'baixa' ? 'QUEDA' : 'LATERAL'

  const vwap =
    m.vwap == null
      ? '—'
      : price >= m.vwap * 1.002
        ? 'ACIMA'
        : price <= m.vwap * 0.998
          ? 'ABAIXO'
          : 'NO VWAP'

  let ema = 'MISTO'
  if (m.ema20 != null && m.ema50 != null) {
    if (price > m.ema20 && m.ema20 > m.ema50) ema = 'ALTA'
    else if (price < m.ema20 && m.ema20 < m.ema50) ema = 'BAIXA'
    else ema = 'LATERAL'
  }

  return { volume: vol, macd, htf, rsi, projection, vwap, ema }
}

function macdActionLabel(m: BarMetrics, direction: 'buy' | 'sell'): string {
  if (direction === 'buy') {
    if (m.macdCross === 'bullish') return 'COMPRA'
    if (m.macdHist != null && m.macdHist > 0) return 'ALTA'
    return 'BAIXA'
  }
  if (m.macdCross === 'bearish') return 'VENDA'
  if (m.macdHist != null && m.macdHist < 0) return 'BAIXA'
  return 'ALTA'
}

function buildChecklist(
  m: BarMetrics,
  price: number,
  signal: TrendRadarSignalType,
  buySc: { score: number; criteria: TrendRadarAnalysis['criteria'] },
  sellSc: { score: number; criteria: TrendRadarAnalysis['criteria'] },
  market: ReturnType<typeof computeMarketBias>,
  htfLabel: string,
  divergence: TrendRadarAnalysis['divergence'],
  projectedPrice: number | null,
  params: SignalEngineParams,
): TrendRadarAnalysis['checklist'] {
  const dir: 'buy' | 'sell' =
    market.bias === 'alta' ? 'buy' : market.bias === 'baixa' ? 'sell' : sellSc.score > buySc.score ? 'sell' : 'buy'
  const sc = dir === 'buy' ? buySc : sellSc
  const c = evaluateCriteria(
    m,
    price,
    dir,
    regimeAt(m, price),
    divergence === 'alta' ? 'bullish' : divergence === 'baixa' ? 'bearish' : 'none',
    signal !== 'none',
    params,
  )
  const display = buildDisplayLabels(m, price)

  const items: TrendRadarAnalysis['checklist']['items'] = [
    { id: 'rsi', label: 'RSI', value: display.rsi, ok: c.rsi, core: true },
    { id: 'adx', label: 'ADX', value: m.adx != null ? m.adx.toFixed(1) : '—', ok: c.adx, core: true },
    { id: 'macd', label: 'MACD', value: m.macdHist != null ? m.macdHist.toFixed(2) : '—', ok: c.macd, core: true },
    { id: 'volume', label: 'Volume', value: m.volume > 0 ? Math.round(m.volume).toLocaleString('pt-BR') : '—', ok: c.volume, core: true },
    { id: 'htf', label: `HTF (${htfLabel})`, value: display.htf, ok: c.htf, core: true },
    {
      id: 'poc',
      label: 'POC',
      value: m.poc != null ? m.poc.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—',
      ok: c.poc,
    },
    {
      id: 'projection',
      label: 'Projeção',
      value:
        projectedPrice != null
          ? projectedPrice.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
          : display.projection,
      ok: c.projection,
    },
    {
      id: 'ema20',
      label: 'EMA 20',
      value: m.ema20 != null ? m.ema20.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—',
      ok: c.ema20,
    },
    {
      id: 'ema50',
      label: 'EMA 50',
      value: m.ema50 != null ? m.ema50.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—',
      ok: c.ema50,
    },
    {
      id: 'ema200',
      label: 'EMA 200',
      value: m.ema200 != null ? m.ema200.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—',
      ok: c.ema200,
    },
    {
      id: 'atr',
      label: 'ATR (SL)',
      value: m.atr != null ? m.atr.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—',
      ok: m.atr != null && m.atr > 0,
    },
    { id: 'vwap', label: 'VWAP', value: display.vwap, ok: c.vwap },
    {
      id: 'divergence',
      label: 'Divergência',
      value: divergence === 'alta' ? 'ALTA' : divergence === 'baixa' ? 'BAIXA' : 'NENHUMA',
      ok: c.divergence,
    },
  ]

  const coreItems = items.filter((i) => i.core)
  const coreConfirmed = coreItems.filter((i) => i.ok).length
  const mainItems = items.filter((i) => i.id !== 'divergence')
  const confirmed = mainItems.filter((i) => i.ok).length
  const missing = mainItems.filter((i) => !i.ok).map((i) => i.label)

  const directionLabel =
    market.bias === 'baixa'
      ? 'TENDÊNCIA DE QUEDA'
      : market.bias === 'alta'
        ? 'TENDÊNCIA DE ALTA'
        : signal === 'buy'
          ? 'COMPRA'
          : signal === 'sell'
            ? 'VENDA'
            : 'INDEFINIDO'

  const ready =
    signal !== 'none' &&
    coreConfirmed >= params.minCoreConfluence &&
    confirmed >= params.minConfluence &&
    sc.score >= params.signalMinScore

  return {
    direction: signal === 'none' ? 'wait' : signal,
    directionLabel,
    confirmed,
    total: mainItems.length,
    coreConfirmed,
    coreTotal: coreItems.length,
    ready,
    missing: missing.slice(0, 5),
    items,
  }
}

function computeMarketBias(
  m: BarMetrics,
  price: number,
  regime: TrendRegime,
  divergence: 'bullish' | 'bearish' | 'none',
): {
  bias: 'alta' | 'baixa' | 'lateral'
  call: string
  assertivenessPct: number
  bullVotes: number
  bearVotes: number
} {
  let bull = 0
  let bear = 0

  if (m.ema9 != null && m.ema21 != null) {
    if (m.ema9 > m.ema21) bull += 5
    else if (m.ema9 < m.ema21) bear += 5
  }

  if (m.htf === 'alta') bull += 5
  else if (m.htf === 'baixa') bear += 5

  if (m.macdCross === 'bullish') bull += 4
  if (m.macdCross === 'bearish') bear += 4
  if (m.macdHist != null) {
    if (m.macdHist > 0) bull += 2
    else if (m.macdHist < 0) bear += 2
  }

  const r = m.rsi
  if (r != null) {
    if (r >= 58) bear += 3
    else if (r <= 42) bull += 3
    else if (r > 50) bear += 1
    else if (r < 50) bull += 1
  }

  if (m.adx != null && m.adx >= 20) {
    if (regime === 'bear') bear += 3
    else if (regime === 'bull') bull += 3
    else if (m.ema20 != null && m.ema50 != null) {
      if (m.ema20 < m.ema50) bear += 2
      else if (m.ema20 > m.ema50) bull += 2
    }
  }

  if (regime === 'bear') bear += 4
  else if (regime === 'bull') bull += 4

  if (m.ema20 != null && m.ema50 != null) {
    if (price < m.ema20 && m.ema20 < m.ema50) bear += 3
    else if (price > m.ema20 && m.ema20 > m.ema50) bull += 3
  }

  if (m.ema200 != null) {
    if (price < m.ema200) bear += 2
    else bull += 2
  }

  if (m.projection === 'baixa') bear += 3
  else if (m.projection === 'alta') bull += 3

  if (m.vwap != null) {
    if (price < m.vwap) bear += 2
    else bull += 2
  }

  if (m.poc != null) {
    if (price < m.poc) bear += 1
    else bull += 1
  }

  if (m.volRatio != null && m.volRatio >= 0.95) {
    if (bear >= bull) bear += 2
    else bull += 2
  }

  if (divergence === 'bearish') bear += 4
  if (divergence === 'bullish') bull += 4

  const total = bull + bear
  const diff = Math.abs(bull - bear)
  const assertivenessPct = total > 0 ? Math.min(96, Math.round(40 + (diff / total) * 60)) : 50

  let bias: 'alta' | 'baixa' | 'lateral'
  if (bear > bull) bias = 'baixa'
  else if (bull > bear) bias = 'alta'
  else bias = 'lateral'

  const call =
    bias === 'baixa'
      ? 'MERCADO VAI CAIR'
      : bias === 'alta'
        ? 'MERCADO VAI SUBIR'
        : 'MERCADO INDEFINIDO'

  return { bias, call, assertivenessPct, bullVotes: bull, bearVotes: bear }
}

function resolveSignal(
  m: BarMetrics,
  price: number,
  regime: TrendRegime,
  divergence: 'bullish' | 'bearish' | 'none',
  params: SignalEngineParams,
): {
  signal: TrendRadarSignalType
  score: number
  criteria: TrendRadarAnalysis['criteria']
  market: ReturnType<typeof computeMarketBias>
} {
  const market = computeMarketBias(m, price, regime, divergence)
  const buySc = scoreBar(m, price, 'buy', regime, divergence, params)
  const sellSc = scoreBar(m, price, 'sell', regime, divergence, params)

  if (market.bias === 'baixa') {
    const criteria = evaluateCriteria(m, price, 'sell', regime, divergence, true, params)
    const score = scoreFromCriteria(criteria)
    const core = coreSellHits(m)
    const confluence = countConfluence(criteria)
    const operable =
      score >= params.signalMinScore &&
      core >= params.minCoreConfluence &&
      confluence >= params.minConfluence &&
      sellSc.score >= buySc.score &&
      canSell(m, price, regime)
    return { signal: operable ? 'sell' : 'none', score, criteria, market }
  }

  if (market.bias === 'alta') {
    const criteria = evaluateCriteria(m, price, 'buy', regime, divergence, true, params)
    const score = scoreFromCriteria(criteria)
    const core = coreBuyHits(m)
    const confluence = countConfluence(criteria)
    const operable =
      score >= params.signalMinScore &&
      core >= params.minCoreConfluence &&
      confluence >= params.minConfluence &&
      buySc.score >= sellSc.score &&
      canBuy(m, price, regime)
    return { signal: operable ? 'buy' : 'none', score, criteria, market }
  }

  if (
    sellSc.score >= buySc.score + params.signalScoreGap &&
    sellSc.score >= params.signalStrongScore &&
    canSell(m, price, regime) &&
    countConfluence(sellSc.criteria) >= params.minConfluence
  ) {
    return {
      signal: 'sell',
      score: sellSc.score,
      criteria: sellSc.criteria,
      market,
    }
  }
  if (
    buySc.score >= sellSc.score + params.signalScoreGap &&
    buySc.score >= params.signalStrongScore &&
    canBuy(m, price, regime) &&
    countConfluence(buySc.criteria) >= params.minConfluence
  ) {
    return {
      signal: 'buy',
      score: buySc.score,
      criteria: buySc.criteria,
      market,
    }
  }

  const best = sellSc.score >= buySc.score ? sellSc : buySc
  const tradeDir = sellSc.score >= buySc.score ? 'sell' : 'buy'
  const criteria = evaluateCriteria(m, price, tradeDir, regime, divergence, false, params)
  return { signal: 'none', score: best.score, criteria, market }
}

function backtestHorizonBars(chartLabel: string): number {
  // Janela de espera para o alvo (TP) ser atingido — mais folga = mais acertos reais.
  const map: Record<string, number> = {
    '1m': 48,
    '5m': 44,
    '15m': 40,
    '1h': 32,
    '4h': 24,
    '1d': 14,
    '1w': 12,
    '1M': 8,
    '2mo': 8,
    '3mo': 6,
    '6mo': 5,
    '1y': 5,
    '3y': 4,
  }
  return map[chartLabel] ?? 12
}

function evaluateSignalOutcome(
  bars: OhlcvBar[],
  atrS: (number | null)[],
  index: number,
  type: 'buy' | 'sell',
  maxHold: number,
  params: SignalEngineParams,
): { outcome: 'win' | 'loss'; exitPrice: number; pnlPct: number } {
  const entry = bars[index]!.close
  const atr = atrS[index] ?? entry * 0.02
  const { takeProfit: tp, stopLoss: sl } = tpSlFromAtr(entry, atr, type, params)
  const end = Math.min(bars.length - 1, index + maxHold)

  for (let j = index + 1; j <= end; j++) {
    const h = bars[j]!.high
    const l = bars[j]!.low
    if (type === 'buy') {
      if (l <= sl) return { outcome: 'loss', exitPrice: sl, pnlPct: evaluateTradePnl(entry, sl, type) }
      if (h >= tp) return { outcome: 'win', exitPrice: tp, pnlPct: evaluateTradePnl(entry, tp, type) }
    } else {
      if (h >= sl) return { outcome: 'loss', exitPrice: sl, pnlPct: evaluateTradePnl(entry, sl, type) }
      if (l <= tp) return { outcome: 'win', exitPrice: tp, pnlPct: evaluateTradePnl(entry, tp, type) }
    }
  }

  const closeEnd = bars[end]!.close
  const outcome = type === 'buy' ? (closeEnd >= entry ? 'win' : 'loss') : closeEnd <= entry ? 'win' : 'loss'
  return { outcome, exitPrice: closeEnd, pnlPct: evaluateTradePnl(entry, closeEnd, type) }
}

type RadarSeriesBundle = {
  rsiS: (number | null)[]
  adxS: (number | null)[]
  macdOut: ReturnType<typeof macd>
  ema9S: (number | null)[]
  ema21S: (number | null)[]
  ema20S: (number | null)[]
  ema50S: (number | null)[]
  ema200S: (number | null)[]
  volSma: (number | null)[]
  vwapS: (number | null)[]
  atrS: (number | null)[]
  htfBars?: OhlcvBar[]
  params: SignalEngineParams
}

function balanceMarkers(markers: TrendRadarMarker[], maxTotal = 14): TrendRadarMarker[] {
  const buys = markers.filter((m) => m.type === 'buy')
  const sells = markers.filter((m) => m.type === 'sell')
  const half = Math.ceil(maxTotal / 2)
  return [...sells.slice(-half), ...buys.slice(-half)].sort((a, b) => a.time - b.time)
}

/** Topo local confirmado: high[i] é o maior numa janela ±span. */
function isPivotHigh(bars: OhlcvBar[], i: number, span: number): boolean {
  if (i - span < 0 || i + span >= bars.length) return false
  const h = bars[i]!.high
  for (let j = i - span; j <= i + span; j++) {
    if (j !== i && bars[j]!.high > h) return false
  }
  return true
}

/** Fundo local confirmado: low[i] é o menor numa janela ±span. */
function isPivotLow(bars: OhlcvBar[], i: number, span: number): boolean {
  if (i - span < 0 || i + span >= bars.length) return false
  const l = bars[i]!.low
  for (let j = i - span; j <= i + span; j++) {
    if (j !== i && bars[j]!.low < l) return false
  }
  return true
}

/**
 * Sinais ancorados em TOPOS (SELL) e FUNDOS (BUY) reais, não em cruzamentos
 * a meio da tendência. Cada pivô é confirmado por momentum/RSI para reduzir ruído.
 */
function collectOperableSignals(
  bars: OhlcvBar[],
  closes: number[],
  bundle: RadarSeriesBundle,
): TrendRadarMarker[] {
  const { params, htfBars } = bundle
  const out: TrendRadarMarker[] = []
  let lastBuyIdx = -999
  let lastSellIdx = -999

  // Janela do pivô: maior em timeframes longos para apanhar swings reais.
  const span = bars.length > 400 ? 2 : 3

  for (let i = MIN_BARS; i < bars.length; i++) {
    const p = closes[i]!
    const poc = pocAtIndex(bars, i, params.pocLookback)
    const htf = htfTrendAtTime(htfBars, bars[i]!.time)
    const m = metricsAtIndex(
      i,
      bars,
      bundle.rsiS,
      bundle.adxS,
      bundle.macdOut,
      bundle.ema20S,
      bundle.ema50S,
      bundle.ema200S,
      bundle.ema9S,
      bundle.ema21S,
      bundle.volSma,
      bundle.vwapS,
      bundle.atrS,
      poc,
      htf,
    )
    const reg = regimeAt(m, p)
    const div = detectRsiDivergence(bars.slice(0, i + 1), bundle.rsiS.slice(0, i + 1))
    const sig = resolveSignal(m, p, reg, div, params)
    const r = m.rsi
    const adxOk = m.adx == null || m.adx >= params.adxMin - 4

    let type: 'buy' | 'sell' | null = null

    // SELL só em topo FORTE: pivô de máxima + confirmação real (RSI alto, MACD baixa ou divergência).
    if (isPivotHigh(bars, i, span)) {
      const strongTop =
        (r != null && r >= 55) || div === 'bearish' || m.macdCross === 'bearish'
      const notBottom = r == null || r >= 48
      if (strongTop && notBottom && adxOk && reg !== 'bull') type = 'sell'
      else if (sig.signal === 'sell') type = 'sell'
    }

    // BUY só em fundo FORTE: pivô de mínima + confirmação real (RSI baixo, MACD alta ou divergência).
    if (!type && isPivotLow(bars, i, span)) {
      const strongBottom =
        (r != null && r <= 45) || div === 'bullish' || m.macdCross === 'bullish'
      const notTop = r == null || r <= 55
      if (strongBottom && notTop && adxOk && reg !== 'bear') type = 'buy'
      else if (sig.signal === 'buy') type = 'buy'
    }

    if (!type) continue
    if (type === 'buy' && i - lastBuyIdx < params.minSignalGapBars) continue
    if (type === 'sell' && i - lastSellIdx < params.minSignalGapBars) continue

    if (type === 'buy') lastBuyIdx = i
    else lastSellIdx = i

    out.push({ time: bars[i]!.time, type, price: p, score: sig.score })
  }
  return out
}

function computeFullBacktest(
  bars: OhlcvBar[],
  bundle: RadarSeriesBundle,
  chartLabel: string,
  startIndex = 0,
): SignalBacktestResult {
  const horizon = backtestHorizonBars(chartLabel)
  const signals = collectOperableSignals(bars, bars.map((b) => b.close), bundle)
  const timeToIndex = new Map(bars.map((b, i) => [b.time, i]))
  const trades: SignalBacktestResult['trades'] = []

  // O pivô só é confirmado `span` velas depois — a entrada realista é nessa vela.
  const span = bars.length > 400 ? 2 : 3

  for (const sig of signals) {
    const pivotIdx = timeToIndex.get(sig.time)
    if (pivotIdx == null) continue
    const idx = pivotIdx + span
    if (idx < startIndex) continue
    if (idx >= bars.length - 2 || idx + horizon >= bars.length) continue
    const result = evaluateSignalOutcome(bars, bundle.atrS, idx, sig.type, horizon, bundle.params)
    // Desconta taxas + slippage; um ganho só conta como vitória se cobrir o custo.
    const netPnl = result.pnlPct - ROUND_TRIP_COST_PCT
    trades.push({
      type: sig.type,
      entryIndex: idx,
      entryPrice: bars[idx]!.close,
      exitPrice: result.exitPrice,
      pnlPct: Math.round(netPnl * 100) / 100,
      outcome: netPnl > 0 ? 'win' : 'loss',
    })
  }

  return buildBacktestFromTrades(trades, horizon, bars.length)
}

export function computeTrendRadar(
  bars: OhlcvBar[],
  htfBars?: OhlcvBar[],
  options: TrendRadarOptions = {},
): TrendRadarAnalysis | null {
  if (bars.length < MIN_BARS) return null

  const params = resolveParams(options.params)
  const closes = bars.map((b) => b.close)
  const highs = bars.map((b) => b.high)
  const lows = bars.map((b) => b.low)
  const volumes = bars.map((b) => b.volume)

  const rsiS = rsi(closes, params.rsiPeriod)
  const adxS = adx(highs, lows, closes, params.adxPeriod)
  const macdOut = macd(closes, params.macdFast, params.macdSlow, params.macdSignal)
  const ema9S = ema(closes, 9)
  const ema21S = ema(closes, 21)
  const ema20S = ema(closes, params.emaFast)
  const ema50S = ema(closes, params.emaSlow)
  const ema200S = ema(closes, params.emaLong)
  const volSma = sma(volumes, params.volumeSmaPeriod)
  const vwapS = rollingVwap(bars, params.vwapLookback)
  const atrS = atr(highs, lows, closes, params.atrPeriod)
  const poc = computePoc(bars, params.pocLookback)
  const htf = htfTrendFromBars(htfBars)
  const divergenceRaw = detectRsiDivergence(bars, rsiS)
  const divergence: TrendRadarAnalysis['divergence'] =
    divergenceRaw === 'bullish' ? 'alta' : divergenceRaw === 'bearish' ? 'baixa' : 'nenhuma'
  const htfLabel = options.htfLabel ?? 'HTF'
  const chartLabel = options.chartLabel ?? 'Gráfico'

  const last = bars.length - 1
  const price = closes[last]!
  const mLast = metricsAtIndex(
    last,
    bars,
    rsiS,
    adxS,
    macdOut,
    ema20S,
    ema50S,
    ema200S,
    ema9S,
    ema21S,
    volSma,
    vwapS,
    atrS,
    poc,
    htf,
  )

  const regime = regimeAt(mLast, price)
  const buySc = scoreBar(mLast, price, 'buy', regime, divergenceRaw, params)
  const sellSc = scoreBar(mLast, price, 'sell', regime, divergenceRaw, params)
  const resolved = resolveSignal(mLast, price, regime, divergenceRaw, params)
  const projectedPrice = projectedPriceAt(mLast, price)
  const { market } = resolved

  const { strength, label, qualityLabel } = strengthFromScore(
    resolved.signal === 'none'
      ? Math.max(0, market.assertivenessPct - 25)
      : resolved.score,
  )

  const atrVal = mLast.atr ?? 0
  const direction: TrendRadarAnalysis['direction'] = market.bias

  const pocRelation: TrendRadarAnalysis['pocRelation'] =
    poc == null
      ? 'at'
      : price > poc * 1.003
        ? 'above'
        : price < poc * 0.997
          ? 'below'
          : 'at'

  const bundle: RadarSeriesBundle = {
    rsiS,
    adxS,
    macdOut,
    ema9S,
    ema21S,
    ema20S,
    ema50S,
    ema200S,
    volSma,
    vwapS,
    atrS,
    htfBars,
    params,
  }

  const backtest = computeFullBacktest(bars, bundle, chartLabel, options.backtestStartIndex ?? 0)
  const historicalAccuracy = {
    winRatePct: backtest.winRatePct,
    wins: backtest.wins,
    losses: backtest.losses,
    total: backtest.total,
    horizonBars: backtest.horizonBars,
    chartBars: backtest.chartBars,
  }
  const allMarkers = collectOperableSignals(bars, closes, bundle)
  const deduped = options.skipMarkersLimit ? allMarkers : balanceMarkers(allMarkers, 14)

  // Sinal ao vivo: se um topo/fundo acabou de confirmar (pivô recente), reflete-o;
  // caso contrário, usa a leitura de tendência da última vela.
  const pivotSpan = bars.length > 400 ? 2 : 3
  const lastMk = allMarkers.length ? allMarkers[allMarkers.length - 1] : null
  let liveSignal = resolved.signal
  if (lastMk) {
    const mkIdx = bars.findIndex((b) => b.time === lastMk.time)
    if (mkIdx >= 0 && (bars.length - 1) - mkIdx <= pivotSpan + 1) {
      liveSignal = lastMk.type
    }
  }

  const tpSlSignal =
    liveSignal !== 'none'
      ? liveSignal
      : market.bias === 'alta'
        ? 'buy'
        : market.bias === 'baixa'
          ? 'sell'
          : 'none'
  const tpSl =
    tpSlSignal === 'buy' || tpSlSignal === 'sell'
      ? tpSlFromAtr(price, atrVal, tpSlSignal, params)
      : null
  const takeProfit = tpSl?.takeProfit ?? null
  const stopLoss = tpSl?.stopLoss ?? null

  const coreBuy = coreBuyHits(mLast)
  const coreSell = coreSellHits(mLast)
  const htfConfirmed =
    resolved.signal === 'buy'
      ? mLast.htf === 'alta' && coreBuy >= 4
      : resolved.signal === 'sell'
        ? mLast.htf === 'baixa' && coreSell >= 4
        : false

  const trendForcePct = Math.min(100, Math.max(0, (mLast.adx ?? 0) * 2.2))

  const checklist = buildChecklist(
    mLast,
    price,
    resolved.signal,
    buySc,
    sellSc,
    market,
    htfLabel,
    divergence,
    projectedPrice,
    params,
  )

  return {
    signal: liveSignal,
    score: resolved.score,
    strength,
    strengthLabel: label,
    qualityLabel:
      liveSignal === 'none'
        ? market.assertivenessPct >= 55
          ? market.bias === 'baixa'
            ? 'TENDÊNCIA DE QUEDA'
            : market.bias === 'alta'
              ? 'TENDÊNCIA DE ALTA'
              : 'NÃO OPERAR'
          : 'NÃO OPERAR'
        : resolved.signal === 'none'
          ? liveSignal === 'buy'
            ? 'FUNDO CONFIRMADO'
            : 'TOPO CONFIRMADO'
          : qualityLabel,
    probabilityPct: Math.min(
      92,
      Math.max(
        30,
        liveSignal === 'none'
          ? Math.round(market.assertivenessPct * 0.55 + historicalAccuracy.winRatePct * 0.45)
          : Math.round(Math.max(resolved.score, 55) * 0.4 + historicalAccuracy.winRatePct * 0.6),
      ),
    ),
    confidencePct: Math.min(
      92,
      Math.max(
        25,
        resolved.score + (htfConfirmed ? 8 : 0) - (resolved.signal === 'none' ? 20 : 0),
      ),
    ),
    direction,
    marketBias: market.bias,
    emaTrend: shortTrend(mLast),
    marketCall: market.call,
    assertivenessPct: market.assertivenessPct,
    bullVotes: market.bullVotes,
    bearVotes: market.bearVotes,
    regime,
    trendForcePct,
    takeProfit,
    stopLoss,
    rsi: mLast.rsi,
    adx: mLast.adx,
    macdHist: mLast.macdHist,
    macdCross: mLast.macdCross,
    volumeRatio: mLast.volRatio,
    htfTrend: htf,
    htfConfirmed,
    poc,
    pocRelation,
    projection: mLast.projection,
    ema20: mLast.ema20,
    ema50: mLast.ema50,
    ema200: mLast.ema200,
    vwap: mLast.vwap,
    atr: mLast.atr,
    markers: deduped,
    criteria: resolved.criteria,
    display: buildDisplayLabels(mLast, price),
    checklist,
    divergence,
    projectedPrice,
    htfLabel,
    chartLabel,
    historicalAccuracy,
    backtest,
    engineParams: params,
    optimization: options.optimization ?? null,
  }
}
