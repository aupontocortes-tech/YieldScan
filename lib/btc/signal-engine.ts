import { ema, rsi, sma } from '@/lib/btc/indicators'
import type { RsiSettings } from '@/lib/btc/types'

export type TradeSignal =
  | '🔥 STRONG BUY'
  | '🟢 BUY'
  | '⚪ NEUTRAL'
  | '🟠 SELL'
  | '🔴 STRONG SELL'

export type MarketRegime =
  | '🚀 Strong Bull'
  | '📈 Bull'
  | '⚖️ Neutral'
  | '📉 Bear'
  | '💀 Strong Bear'

export type SignalAlert = { type: 'bottom' | 'top'; message: string }

export type SignalEngineResult = {
  score: number
  tradeSignal: TradeSignal
  marketRegime: MarketRegime
  alerts: SignalAlert[]
}

function tradeSignalFromScore(score: number): TradeSignal {
  if (score >= 55) return '🔥 STRONG BUY'
  if (score >= 22) return '🟢 BUY'
  if (score >= -21) return '⚪ NEUTRAL'
  if (score >= -52) return '🟠 SELL'
  return '🔴 STRONG SELL'
}

function marketRegimeFromScore(score: number): MarketRegime {
  if (score > 70) return '🚀 Strong Bull'
  if (score > 40) return '📈 Bull'
  if (score > 10) return '⚖️ Neutral'
  if (score > -30) return '📉 Bear'
  return '💀 Strong Bear'
}

/**
 * Rule-based score (-100..100) and labels. Uses internal MA50/MA200, RSI settings, volume SMA20, EMA9 vs EMA21 trend.
 */
export function runSignalEngine(
  closes: number[],
  volumes: number[],
  rsiSettings: RsiSettings
): SignalEngineResult {
  const alerts: SignalAlert[] = []
  const n = closes.length
  if (n < 50) {
    return {
      score: 0,
      tradeSignal: '⚪ NEUTRAL',
      marketRegime: '⚖️ Neutral',
      alerts: [],
    }
  }

  const rsiSeries = rsi(closes, rsiSettings.period)
  const ma50 = sma(closes, 50)
  const ma200 = sma(closes, 200)
  const volAvg = sma(volumes, 20)
  const ema9 = ema(closes, 9)
  const ema21 = ema(closes, 21)

  const i = n - 1
  const price = closes[i]
  const r = rsiSeries[i]
  const v = volumes[i]
  const va = volAvg[i]

  let score = 0

  if (r != null) {
    if (r < rsiSettings.oversold) {
      score += 25
      alerts.push({ type: 'bottom', message: 'Possible bottom (RSI oversold).' })
    }
    if (r > rsiSettings.overbought) {
      score -= 25
      alerts.push({ type: 'top', message: 'Possible top (RSI overbought).' })
    }
  }

  const m50 = ma50[i]
  const m200 = ma200[i]
  if (m200 != null && price < m200) score += 25
  if (m50 != null && price > m50) score -= 10

  if (va != null && v > va) score += 20

  const e9 = ema9[i]
  const e21 = ema21[i]
  if (e9 != null && e21 != null) {
    if (e9 > e21) score += 20
    else score -= 20
  }

  score = Math.max(-100, Math.min(100, score))

  return {
    score,
    tradeSignal: tradeSignalFromScore(score),
    marketRegime: marketRegimeFromScore(score),
    alerts,
  }
}
