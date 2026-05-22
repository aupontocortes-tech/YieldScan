import { alignWeeklySeriesToBars, ema, sma } from '@/lib/btc/indicators'
import { toHeikinAshi } from '@/lib/btc/heikin-ashi'
import {
  BULL_MARKET_BAND_EMA_WEEKS,
  BULL_MARKET_BAND_SMA_WEEKS,
  type OhlcvBar,
} from '@/lib/btc/types'

export const SMA_200_DAILY_PERIOD = 200
export const SMA_50_DAILY_PERIOD = 50
export const SMA_50_WEEKLY_PERIOD = 50

export type GoldenCrossState = {
  regime: 'golden' | 'death' | 'neutral'
  message: string
}

export type CycleBottomSignalState = {
  signal1: boolean
  signal2: boolean
  messages: string[]
}

/** Alinha série diária (ex. SMA 200) ao eixo temporal do gráfico atual. */
export function alignDailySeriesToBars(
  bars: OhlcvBar[],
  dailyBars: OhlcvBar[],
  dailySeries: (number | null)[],
): (number | null)[] {
  const n = bars.length
  if (n === 0 || dailyBars.length === 0) return Array(n).fill(null)
  const out: (number | null)[] = Array(n).fill(null)
  let di = 0
  for (let i = 0; i < n; i++) {
    const t = bars[i].time
    while (di + 1 < dailyBars.length && dailyBars[di + 1].time <= t) di++
    if (dailyBars[di].time <= t) out[i] = dailySeries[di] ?? null
  }
  return out
}

export function computeSma200OnDailyAligned(
  displayBars: OhlcvBar[],
  dailyBars: OhlcvBar[],
): (number | null)[] {
  if (dailyBars.length < SMA_200_DAILY_PERIOD) return Array(displayBars.length).fill(null)
  const closes = dailyBars.map((b) => b.close)
  const sma200 = sma(closes, SMA_200_DAILY_PERIOD)
  return alignDailySeriesToBars(displayBars, dailyBars, sma200)
}

export function computeSma50OnDailyAligned(
  displayBars: OhlcvBar[],
  dailyBars: OhlcvBar[],
): (number | null)[] {
  if (dailyBars.length < SMA_50_DAILY_PERIOD) return Array(displayBars.length).fill(null)
  const closes = dailyBars.map((b) => b.close)
  const sma50 = sma(closes, SMA_50_DAILY_PERIOD)
  return alignDailySeriesToBars(displayBars, dailyBars, sma50)
}

export function computeSma50OnWeeklyAligned(
  displayBars: OhlcvBar[],
  weeklyBars: OhlcvBar[],
): (number | null)[] {
  if (weeklyBars.length < SMA_50_WEEKLY_PERIOD) return Array(displayBars.length).fill(null)
  const closes = weeklyBars.map((b) => b.close)
  const sma50 = sma(closes, SMA_50_WEEKLY_PERIOD)
  return alignWeeklySeriesToBars(displayBars, weeklyBars, sma50)
}

export function computeBullMarketBandOnChart(
  displayBars: OhlcvBar[],
  weeklyBars: OhlcvBar[],
): { sma: (number | null)[]; ema: (number | null)[]; upper: (number | null)[] } | null {
  if (weeklyBars.length < BULL_MARKET_BAND_EMA_WEEKS + 1) return null
  const wc = weeklyBars.map((b) => b.close)
  const smaW = sma(wc, BULL_MARKET_BAND_SMA_WEEKS)
  const emaW = ema(wc, BULL_MARKET_BAND_EMA_WEEKS)
  const smaA = alignWeeklySeriesToBars(displayBars, weeklyBars, smaW)
  const emaA = alignWeeklySeriesToBars(displayBars, weeklyBars, emaW)
  const upper = smaA.map((s, i) => {
    const e = emaA[i]
    if (s == null && e == null) return null
    if (s == null) return e
    if (e == null) return s
    return Math.max(s, e)
  })
  return { sma: smaA, ema: emaA, upper }
}

/**
 * Sinal 1: fecho diário acima da SMA 200 diária.
 * Sinal 2: corpo HA mensal (verde) acima do topo da Bull Market Band (semanal).
 */
export function evaluateCycleBottomSignals(
  dailyBars: OhlcvBar[],
  weeklyBars: OhlcvBar[],
  monthlyBars: OhlcvBar[],
): CycleBottomSignalState {
  const messages: string[] = []
  let signal1 = false
  let signal2 = false

  if (dailyBars.length >= SMA_200_DAILY_PERIOD) {
    const closes = dailyBars.map((b) => b.close)
    const sma200 = sma(closes, SMA_200_DAILY_PERIOD)
    const lastIdx = dailyBars.length - 1
    const px = closes[lastIdx]
    const ma = sma200[lastIdx]
    if (px != null && ma != null && px > ma) {
      signal1 = true
      messages.push('Sinal 1: Rompimento da SMA 200 Diária')
    }
  }

  if (weeklyBars.length >= BULL_MARKET_BAND_EMA_WEEKS + 1 && monthlyBars.length >= 2) {
    const wc = weeklyBars.map((b) => b.close)
    const smaW = sma(wc, BULL_MARKET_BAND_SMA_WEEKS)
    const emaW = ema(wc, BULL_MARKET_BAND_EMA_WEEKS)
    const lastW = weeklyBars.length - 1
    const s = smaW[lastW]
    const e = emaW[lastW]
    const bandTop = s != null && e != null ? Math.max(s, e) : s ?? e

    const ha = toHeikinAshi(monthlyBars)
    const lastHa = ha[ha.length - 1]
    if (
      bandTop != null &&
      lastHa.haClose > bandTop &&
      lastHa.haClose > lastHa.haOpen
    ) {
      signal2 = true
      messages.push('Sinal 2: Fechamento mensal (Heikin Ashi) acima da Bull Market Band')
    }
  }

  return { signal1, signal2, messages }
}

/** Estado actual das médias 50/200 diárias (Golden Cross / Death Cross). */
export function evaluateGoldenCrossState(dailyBars: OhlcvBar[]): GoldenCrossState {
  if (dailyBars.length < SMA_200_DAILY_PERIOD) {
    return { regime: 'neutral', message: 'Aguarda dados diários (mín. 200 velas).' }
  }
  const closes = dailyBars.map((b) => b.close)
  const sma50 = sma(closes, SMA_50_DAILY_PERIOD)
  const sma200 = sma(closes, SMA_200_DAILY_PERIOD)
  const i = dailyBars.length - 1
  const v50 = sma50[i]
  const v200 = sma200[i]
  const p50 = sma50[i - 1]
  const p200 = sma200[i - 1]

  if (v50 == null || v200 == null) {
    return { regime: 'neutral', message: 'Médias ainda não disponíveis neste ponto.' }
  }

  if (v50 > v200) {
    if (p50 != null && p200 != null && p50 <= p200) {
      return {
        regime: 'golden',
        message: 'Golden Cross: SMA 50 cruzou acima da SMA 200 (sinal bullish).',
      }
    }
    return { regime: 'golden', message: 'SMA 50 acima da SMA 200 — tendência bullish.' }
  }

  if (v50 < v200) {
    if (p50 != null && p200 != null && p50 >= p200) {
      return {
        regime: 'death',
        message: 'Death Cross: SMA 50 cruzou abaixo da SMA 200 (sinal bearish).',
      }
    }
    return { regime: 'death', message: 'SMA 50 abaixo da SMA 200 — tendência bearish.' }
  }

  return { regime: 'neutral', message: 'SMA 50 e SMA 200 muito próximas.' }
}
