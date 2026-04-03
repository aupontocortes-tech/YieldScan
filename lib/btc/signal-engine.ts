import { bollingerBands, ema, rsi, sma } from '@/lib/btc/indicators'
import type { BollingerSettings, RsiSettings } from '@/lib/btc/types'

export type TradeSignal =
  | '🔥 STRONG BUY'
  | '🟢 BUY'
  | '⚪ NEUTRAL'
  | '🟠 SELL'
  | '🔴 STRONG SELL'

/** Market tone label (score −100…+100). */
export type MarketRegime = 'Strong Bull' | 'Bull' | 'Neutral' | 'Bear' | 'Strong Bear'

export type SignalAlertType = 'bottom' | 'top' | 'whale' | 'bollinger'

export type SignalAlert = { type: SignalAlertType; message: string }

export type SignalEngineResult = {
  score: number
  tradeSignal: TradeSignal
  marketRegime: MarketRegime
  alerts: SignalAlert[]
  trendBullish: boolean | null
}

function tradeSignalFromScore(score: number): TradeSignal {
  if (score >= 55) return '🔥 STRONG BUY'
  if (score >= 22) return '🟢 BUY'
  if (score >= -21) return '⚪ NEUTRAL'
  if (score >= -52) return '🟠 SELL'
  return '🔴 STRONG SELL'
}

function marketRegimeFromScore(score: number): MarketRegime {
  if (score >= 50) return 'Strong Bull'
  if (score >= 18) return 'Bull'
  if (score > -18) return 'Neutral'
  if (score > -50) return 'Bear'
  return 'Strong Bear'
}

export type SignalEngineInput = {
  closes: number[]
  highs: number[]
  lows: number[]
  volumes: number[]
  rsiSettings: RsiSettings
  bollinger: BollingerSettings
}

/**
 * Rule-based score (−100…100) per product spec:
 * RSI oversold / overbought, Bollinger touch, MA200, volume > 2× avg, EMA9 vs EMA21 trend.
 */
export function runSignalEngine(input: SignalEngineInput): SignalEngineResult {
  const { closes, highs, lows, volumes, rsiSettings, bollinger } = input
  const alerts: SignalAlert[] = []
  const n = closes.length

  if (n < 30) {
    return {
      score: 0,
      tradeSignal: '⚪ NEUTRAL',
      marketRegime: 'Neutral',
      alerts: [],
      trendBullish: null,
    }
  }

  const i = n - 1
  const price = closes[i]
  const rsiSeries = rsi(closes, rsiSettings.period)
  const r = rsiSeries[i]

  let score = 0

  if (r != null) {
    if (r < rsiSettings.oversold) {
      score += 25
      alerts.push({ type: 'bottom', message: 'Possible Bottom (RSI oversold).' })
    }
    if (r > rsiSettings.overbought) {
      score -= 25
      alerts.push({ type: 'top', message: 'Possible Top (RSI overbought).' })
    }
  }

  if (bollinger.enabled && n >= bollinger.period) {
    const bb = bollingerBands(closes, bollinger.period, bollinger.stdDev)
    const up = bb.upper[i]
    const lo = bb.lower[i]
    if (up != null && lo != null) {
      if (price < lo) {
        score += 20
        alerts.push({ type: 'bollinger', message: 'Price below lower Bollinger Band.' })
      }
      if (price > up) {
        score -= 20
        alerts.push({ type: 'bollinger', message: 'Price above upper Bollinger Band.' })
      }
    }
  }

  const ma200 = sma(closes, 200)
  const m200 = ma200[i]
  if (m200 != null && price < m200) {
    score += 25
  }

  const volAvg = sma(volumes, 20)
  const va = volAvg[i]
  const v = volumes[i]
  let whaleVol = false
  if (va != null && va > 0 && v > 2 * va) {
    score += 20
    whaleVol = true
    alerts.push({ type: 'whale', message: '🐋 Whale Activity Detected (volume > 2× average).' })
  }

  const e9 = ema(closes, 9)[i]
  const e21 = ema(closes, 21)[i]
  let trendBullish: boolean | null = null
  if (e9 != null && e21 != null) {
    trendBullish = e9 > e21
    if (e9 > e21) score += 20
    else score -= 20
  }

  const hi = highs[i]
  const loC = lows[i]
  if (!whaleVol && hi != null && loC != null && price > 0) {
    const rangePct = (hi - loC) / price
    const look = Math.min(20, i)
    const ranges: number[] = []
    for (let k = 0; k < look; k++) {
      const j = i - k
      const c = closes[j]
      if (c > 0) ranges.push((highs[j] - lows[j]) / c)
    }
    if (ranges.length >= 5) {
      const sorted = [...ranges].sort((a, b) => a - b)
      const med = sorted[Math.floor(sorted.length / 2)] ?? 0
      if (med > 0 && rangePct > med * 2.2) {
        alerts.push({
          type: 'whale',
          message: '🐋 Unusual candle range — possible large player activity.',
        })
      }
    }
  }

  score = Math.max(-100, Math.min(100, score))

  return {
    score,
    tradeSignal: tradeSignalFromScore(score),
    marketRegime: marketRegimeFromScore(score),
    alerts,
    trendBullish,
  }
}
