import { sma } from '@/lib/btc/indicators'
import type { OhlcvBar } from '@/lib/btc/types'

export type AdvancedMetricsResult = {
  /** 0–100 simulated short-term holder / hot money activity */
  sthScore: number
  sthLabel: string
  /** 0–100 simulated long-term holder strength */
  lthScore: number
  lthLabel: string
  whaleDetected: boolean
  whaleSummary: string
}

function clamp01(x: number) {
  return Math.max(0, Math.min(100, x))
}

/**
 * Free-data approximations only — not on-chain STH/LTH; for UI education / heuristics.
 */
export function computeAdvancedMetrics(bars: OhlcvBar[]): AdvancedMetricsResult | null {
  const n = bars.length
  if (n < 60) return null

  const closes = bars.map((b) => b.close)
  const highs = bars.map((b) => b.high)
  const lows = bars.map((b) => b.low)
  const vols = bars.map((b) => b.volume)
  const i = n - 1

  const returns: number[] = []
  const look = Math.min(14, n - 1)
  for (let k = 0; k < look; k++) {
    const j = i - k
    if (j <= 0 || closes[j - 1] <= 0) continue
    returns.push(Math.log(closes[j] / closes[j - 1]))
  }
  const meanR = returns.reduce((a, b) => a + b, 0) / Math.max(1, returns.length)
  const varR =
    returns.reduce((s, x) => s + (x - meanR) ** 2, 0) / Math.max(1, returns.length)
  const volProxy = Math.sqrt(Math.max(varR, 0)) * 100
  const sthScore = clamp01(volProxy * 420)

  const ma100 = sma(closes, 100)[i]
  const ma200 = sma(closes, 200)[i]
  const price = closes[i]
  let lthScore = 40
  if (ma200 != null) {
    const dist = (price - ma200) / ma200
    if (dist > 0.05) lthScore += 25
    else if (dist > 0) lthScore += 12
    else if (dist < -0.15) lthScore -= 20
  }
  if (ma100 != null && ma200 != null) {
    if (ma100 > ma200) lthScore += 15
    else lthScore -= 10
  }
  lthScore += (100 - sthScore) * 0.15
  lthScore = clamp01(lthScore)

  const volAvg = sma(vols, 20)[i]
  const v = vols[i]
  const whaleVol = volAvg != null && volAvg > 0 && v > 2 * volAvg
  const rangePct = price > 0 ? (highs[i] - lows[i]) / price : 0
  const ranges: number[] = []
  for (let k = 0; k < Math.min(20, i); k++) {
    const j = i - k
    const c = closes[j]
    if (c > 0) ranges.push((highs[j] - lows[j]) / c)
  }
  ranges.sort((a, b) => a - b)
  const medRange = ranges[Math.floor(ranges.length / 2)] ?? 0
  const whaleCandle = medRange > 0 && rangePct > medRange * 2.2
  const whaleDetected = whaleVol || whaleCandle

  let whaleSummary = 'No unusual volume or range vs recent bars.'
  if (whaleVol && whaleCandle) whaleSummary = 'Volume > 2× average and wide candle vs median.'
  else if (whaleVol) whaleSummary = 'Volume spike vs 20-bar average (possible large flow).'
  else if (whaleCandle) whaleSummary = 'Single bar range much wider than recent median.'

  return {
    sthScore,
    sthLabel:
      sthScore > 65
        ? 'High short-term churn — volatile swings, more tactical flow (simulated).'
        : sthScore > 35
          ? 'Moderate activity — mixed horizons (simulated).'
          : 'Calmer tape — less frantic short-term trading (simulated).',
    lthScore,
    lthLabel:
      lthScore > 65
        ? 'Price well above long MAs / stable context — narrative of stronger hands (simulated).'
        : lthScore > 40
          ? 'Neutral structure vs 100/200 MA (simulated).'
          : 'Weak vs long averages or high noise — fragile holder base (simulated).',
    whaleDetected,
    whaleSummary,
  }
}
