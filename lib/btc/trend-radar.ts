/**
 * Radar de Tendência — sinais institucionais compostos (RSI, ADX, MACD, EMA, Volume, HTF, POC).
 */

import { ema, macd, rsi, sma } from '@/lib/btc/indicators'
import type { OhlcvBar } from '@/lib/btc/types'

export type TrendRadarSignalType = 'buy' | 'sell' | 'none'

export type TrendRadarMarker = {
  time: number
  type: 'buy' | 'sell'
  price: number
  score: number
}

export type TrendRadarStrength = 'muito_forte' | 'forte' | 'moderado' | 'fraco'

export type TrendRadarAnalysis = {
  signal: TrendRadarSignalType
  score: number
  strength: TrendRadarStrength
  strengthLabel: string
  /** Rótulo institucional: FORTE, MODERADO, FRACO, NÃO OPERAR */
  qualityLabel: string
  probabilityPct: number
  confidencePct: number
  direction: 'alta' | 'baixa' | 'lateral'
  trendForcePct: number
  takeProfit: number | null
  stopLoss: number | null
  rsi: number | null
  adx: number | null
  macdHist: number | null
  macdCross: 'bullish' | 'bearish' | 'none'
  volumeRatio: number | null
  htfTrend: 'alta' | 'baixa' | 'lateral'
  poc: number | null
  pocRelation: 'above' | 'below' | 'at'
  ema20: number | null
  ema50: number | null
  markers: TrendRadarMarker[]
  criteria: {
    rsi: boolean
    adx: boolean
    macd: boolean
    ema: boolean
    volume: boolean
    htf: boolean
    poc: boolean
  }
  /** Rótulos curtos para o painel (estilo vídeo). */
  display: {
    volume: string
    macd: string
    htf: string
    rsi: string
  }
}

const ADX_PERIOD = 14
const POC_LOOKBACK = 60
const POC_BINS = 32
const MIN_BARS = 55

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
  period = ADX_PERIOD,
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

  let atr = 0
  let sp = 0
  let sm = 0
  for (let i = 1; i <= period; i++) {
    atr += tr[i]!
    sp += plusDm[i]!
    sm += minusDm[i]!
  }
  atr /= period
  sp /= period
  sm /= period

  const dxAt = (a: number, p: number, m: number): number => {
    if (a <= 0) return 0
    const dip = (100 * p) / a
    const dim = (100 * m) / a
    const s = dip + dim
    return s <= 0 ? 0 : (100 * Math.abs(dip - dim)) / s
  }

  let adxSmooth = dxAt(atr, sp, sm)
  out[period] = adxSmooth

  for (let i = period + 1; i < n; i++) {
    atr = (atr * (period - 1) + tr[i]!) / period
    sp = (sp * (period - 1) + plusDm[i]!) / period
    sm = (sm * (period - 1) + minusDm[i]!) / period
    const dx = dxAt(atr, sp, sm)
    adxSmooth = (adxSmooth * (period - 1) + dx) / period
    out[i] = adxSmooth
  }
  return out
}

/** POC = preço típico do bin com maior volume (últimas N velas). */
export function computePoc(bars: OhlcvBar[], lookback = POC_LOOKBACK, bins = POC_BINS): number | null {
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
  if (score >= 90) return { strength: 'muito_forte', label: 'Sinal muito forte', qualityLabel: 'MUITO FORTE' }
  if (score >= 75) return { strength: 'forte', label: 'Sinal forte', qualityLabel: 'FORTE' }
  if (score >= 60) return { strength: 'moderado', label: 'Sinal moderado', qualityLabel: 'MODERADO' }
  return { strength: 'fraco', label: 'Não operar', qualityLabel: 'NÃO OPERAR' }
}

function buildDisplayLabels(m: BarMetrics, price: number): TrendRadarAnalysis['display'] {
  const vol =
    m.volRatio == null
      ? '—'
      : m.volRatio >= 1.2
        ? 'FORTE'
        : m.volRatio >= 0.85
          ? 'MÉDIO'
          : 'FRACO'

  let macd = 'NEUTRO'
  if (m.macdCross === 'bullish' || (m.macdHist != null && m.macdHist > 0)) macd = 'ALTA'
  else if (m.macdCross === 'bearish' || (m.macdHist != null && m.macdHist < 0)) macd = 'BAIXA'

  const htf =
    m.htf === 'alta' ? 'ALTA' : m.htf === 'baixa' ? 'QUEDA' : 'LATERAL'

  const rsi =
    m.rsi == null
      ? '—'
      : m.rsi < 35
        ? 'SOBREVENDA'
        : m.rsi > 65
          ? 'SOBRECOMPRA'
          : m.rsi.toFixed(1)

  void price
  return { volume: vol, macd, htf, rsi }
}

function htfTrendFromBars(htfBars: OhlcvBar[] | undefined): 'alta' | 'baixa' | 'lateral' {
  if (!htfBars || htfBars.length < 25) return 'lateral'
  const closes = htfBars.map((b) => b.close)
  const e20 = ema(closes, 20)
  const e50 = ema(closes, 50)
  const i = closes.length - 1
  const a = e20[i]
  const b = e50[i]
  if (a == null || b == null) return 'lateral'
  const diff = ((a - b) / Math.max(b, 1e-12)) * 100
  if (diff > 0.15) return 'alta'
  if (diff < -0.15) return 'baixa'
  return 'lateral'
}

type BarMetrics = {
  rsi: number | null
  adx: number | null
  macdHist: number | null
  macdCross: 'bullish' | 'bearish' | 'none'
  ema20: number | null
  ema50: number | null
  volRatio: number | null
  poc: number | null
  htf: 'alta' | 'baixa' | 'lateral'
}

function metricsAtIndex(
  i: number,
  bars: OhlcvBar[],
  rsiS: (number | null)[],
  adxS: (number | null)[],
  macdOut: ReturnType<typeof macd>,
  ema20S: (number | null)[],
  ema50S: (number | null)[],
  volSma: (number | null)[],
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
    adx: adxS[i] ?? null,
    macdHist: curMacd ?? null,
    macdCross,
    ema20: ema20S[i] ?? null,
    ema50: ema50S[i] ?? null,
    volRatio,
    poc,
    htf,
  }
}

function scoreBar(
  m: BarMetrics,
  price: number,
  direction: 'buy' | 'sell',
): { score: number; criteria: TrendRadarAnalysis['criteria'] } {
  let score = 0
  const criteria = {
    rsi: false,
    adx: false,
    macd: false,
    ema: false,
    volume: false,
    htf: false,
    poc: false,
  }

  const r = m.rsi
  if (direction === 'buy') {
    if (r != null && r < 35) {
      criteria.rsi = true
      score += r < 30 ? 15 : 12
    } else if (r != null && r < 45) score += 5
  } else {
    if (r != null && r > 65) {
      criteria.rsi = true
      score += r > 70 ? 15 : 12
    } else if (r != null && r > 55) score += 5
  }

  const a = m.adx
  if (a != null) {
    if (a >= 25) {
      criteria.adx = true
      score += 14
    } else if (a < 20) score -= 8
    else score += 4
  }

  if (direction === 'buy' && m.macdCross === 'bullish') {
    criteria.macd = true
    score += 15
  } else if (direction === 'sell' && m.macdCross === 'bearish') {
    criteria.macd = true
    score += 15
  } else if (m.macdHist != null) {
    if (direction === 'buy' && m.macdHist > 0) score += 6
    if (direction === 'sell' && m.macdHist < 0) score += 6
  }

  const e20 = m.ema20
  const e50 = m.ema50
  if (e20 != null && e50 != null) {
    if (direction === 'buy' && e20 >= e50) {
      criteria.ema = true
      score += 14
    } else if (direction === 'sell' && e20 <= e50) {
      criteria.ema = true
      score += 14
    } else score += 3
  }

  if (m.volRatio != null && m.volRatio >= 1) {
    criteria.volume = true
    score += Math.min(14, 8 + (m.volRatio - 1) * 4)
  }

  if (direction === 'buy' && m.htf === 'alta') {
    criteria.htf = true
    score += 14
  } else if (direction === 'sell' && m.htf === 'baixa') {
    criteria.htf = true
    score += 14
  } else if (m.htf === 'lateral') score += 4

  const poc = m.poc
  if (poc != null && poc > 0) {
    const rel = price / poc
    if (direction === 'buy' && rel >= 0.995) {
      criteria.poc = true
      score += 14
    } else if (direction === 'sell' && rel <= 1.005) {
      criteria.poc = true
      score += 14
    } else score += 4
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), criteria }
}

function isBuySetup(m: BarMetrics, price: number): boolean {
  const r = m.rsi
  const rsiOk = r != null && r < 35
  const adxOk = m.adx != null && m.adx >= 25
  const macdOk = m.macdCross === 'bullish' || (m.macdHist != null && m.macdHist > 0)
  const emaOk = m.ema20 != null && m.ema50 != null && m.ema20 >= m.ema50
  const volOk = m.volRatio != null && m.volRatio >= 1
  const htfOk = m.htf === 'alta' || m.htf === 'lateral'
  const pocOk = m.poc == null || price >= m.poc * 0.992
  const hits = [rsiOk, adxOk, macdOk, emaOk, volOk, htfOk, pocOk].filter(Boolean).length
  return hits >= 5
}

function isSellSetup(m: BarMetrics, price: number): boolean {
  const r = m.rsi
  const rsiOk = r != null && r > 65
  const adxOk = m.adx != null && m.adx >= 25
  const macdOk = m.macdCross === 'bearish' || (m.macdHist != null && m.macdHist < 0)
  const emaOk = m.ema20 != null && m.ema50 != null && m.ema20 <= m.ema50
  const volOk = m.volRatio != null && m.volRatio >= 1
  const htfOk = m.htf === 'baixa' || m.htf === 'lateral'
  const pocOk = m.poc == null || price <= m.poc * 1.008
  const hits = [rsiOk, adxOk, macdOk, emaOk, volOk, htfOk, pocOk].filter(Boolean).length
  return hits >= 5
}

export function computeTrendRadar(
  bars: OhlcvBar[],
  htfBars?: OhlcvBar[],
): TrendRadarAnalysis | null {
  if (bars.length < MIN_BARS) return null

  const closes = bars.map((b) => b.close)
  const highs = bars.map((b) => b.high)
  const lows = bars.map((b) => b.low)
  const volumes = bars.map((b) => b.volume)

  const rsiS = rsi(closes, 14)
  const adxS = adx(highs, lows, closes, 14)
  const macdOut = macd(closes, 12, 26, 9)
  const ema20S = ema(closes, 20)
  const ema50S = ema(closes, 50)
  const volSma = sma(volumes, 20)
  const poc = computePoc(bars)
  const htf = htfTrendFromBars(htfBars)

  const last = bars.length - 1
  const price = closes[last]!
  const mLast = metricsAtIndex(last, bars, rsiS, adxS, macdOut, ema20S, ema50S, volSma, poc, htf)

  const buyScore = scoreBar(mLast, price, 'buy')
  const sellScore = scoreBar(mLast, price, 'sell')

  let signal: TrendRadarSignalType = 'none'
  let activeScore = Math.max(buyScore.score, sellScore.score)
  let activeCriteria = buyScore.criteria

  if (isBuySetup(mLast, price) && buyScore.score >= sellScore.score) {
    signal = 'buy'
    activeScore = buyScore.score
    activeCriteria = buyScore.criteria
  } else if (isSellSetup(mLast, price) && sellScore.score > buyScore.score) {
    signal = 'sell'
    activeScore = sellScore.score
    activeCriteria = sellScore.criteria
  } else if (buyScore.score >= 60 && buyScore.score > sellScore.score) {
    signal = 'buy'
    activeScore = buyScore.score
    activeCriteria = buyScore.criteria
  } else if (sellScore.score >= 60 && sellScore.score > buyScore.score) {
    signal = 'sell'
    activeScore = sellScore.score
    activeCriteria = sellScore.criteria
  }

  const { strength, label, qualityLabel } = strengthFromScore(activeScore)

  const atr = (() => {
    const trs: number[] = []
    for (let i = 1; i < bars.length; i++) {
      trs.push(
        Math.max(
          highs[i]! - lows[i]!,
          Math.abs(highs[i]! - closes[i - 1]!),
          Math.abs(lows[i]! - closes[i - 1]!),
        ),
      )
    }
    const tail = trs.slice(-14)
    return tail.reduce((a, b) => a + b, 0) / Math.max(tail.length, 1)
  })()

  const takeProfit =
    signal === 'buy' ? price + atr * 2.2 : signal === 'sell' ? price - atr * 2.2 : null
  const stopLoss =
    signal === 'buy' ? price - atr * 1.2 : signal === 'sell' ? price + atr * 1.2 : null

  const direction: TrendRadarAnalysis['direction'] =
    mLast.ema20 != null && mLast.ema50 != null
      ? mLast.ema20 > mLast.ema50
        ? 'alta'
        : mLast.ema20 < mLast.ema50
          ? 'baixa'
          : 'lateral'
      : 'lateral'

  const pocRelation: TrendRadarAnalysis['pocRelation'] =
    poc == null
      ? 'at'
      : price > poc * 1.003
        ? 'above'
        : price < poc * 0.997
          ? 'below'
          : 'at'

  const markers: TrendRadarMarker[] = []
  const scanFrom = Math.max(MIN_BARS, bars.length - 120)
  for (let i = scanFrom; i < bars.length; i++) {
    const p = closes[i]!
    const m = metricsAtIndex(i, bars, rsiS, adxS, macdOut, ema20S, ema50S, volSma, poc, htf)
    if (isBuySetup(m, p)) {
      const sc = scoreBar(m, p, 'buy').score
      if (sc >= 60) markers.push({ time: bars[i]!.time, type: 'buy', price: p, score: sc })
    } else if (isSellSetup(m, p)) {
      const sc = scoreBar(m, p, 'sell').score
      if (sc >= 60) markers.push({ time: bars[i]!.time, type: 'sell', price: p, score: sc })
    }
  }

  const deduped: TrendRadarMarker[] = []
  for (const mk of markers) {
    const prev = deduped[deduped.length - 1]
    if (prev && prev.type === mk.type && mk.time - prev.time < 3) continue
    deduped.push(mk)
  }

  const trendForcePct = Math.min(100, Math.max(0, (mLast.adx ?? 0) * 2.5))

  return {
    signal,
    score: activeScore,
    strength,
    strengthLabel: label,
    qualityLabel,
    probabilityPct: Math.min(92, Math.max(35, activeScore - 5)),
    confidencePct: Math.min(95, Math.max(30, activeScore)),
    direction,
    trendForcePct,
    takeProfit,
    stopLoss,
    rsi: mLast.rsi,
    adx: mLast.adx,
    macdHist: mLast.macdHist,
    macdCross: mLast.macdCross,
    volumeRatio: mLast.volRatio,
    htfTrend: htf,
    poc,
    pocRelation,
    ema20: mLast.ema20,
    ema50: mLast.ema50,
    markers: deduped.slice(-12),
    criteria: activeCriteria,
    display: buildDisplayLabels(mLast, price),
  }
}
