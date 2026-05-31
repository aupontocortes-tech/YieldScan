import type { RawMarketCoin, RawTrending } from '@/lib/tendencias/fetch-data'
import type { RawProtocolFees } from '@/lib/tendencias/fetch-defi'
import {
  TRIM_CLASS_LABEL,
  TRIM_WEIGHTS,
  trimClassFromScore,
  type TrimClass,
} from '@/lib/tendencias/trim-config'
import type { MomentumClass, MomentumPeriod } from '@/lib/tendencias/types'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export type TrimSubScores = {
  momentum: number
  volume: number
  news: number
  defi: number
  relevance: number
}

export type TrimTokenScores = TrimSubScores & {
  trimScore: number
  trimClass: TrimClass
  trimLabel: string
  volumeScore: number
  momentumClass: MomentumClass
  momentumReason: string
  strength: number
}

function periodChanges(c: RawMarketCoin) {
  const c7 = c.price_change_percentage_7d_in_currency ?? c.price_change_percentage_24h ?? 0
  const c30 = c.price_change_percentage_30d_in_currency ?? c7
  const c90 =
    c.price_change_percentage_200d_in_currency ??
    c.price_change_percentage_30d_in_currency ??
    c7
  const c24 = c.price_change_percentage_24h ?? 0
  return { c7, c30, c90, c24 }
}

/** Score 0–100 a partir de variações 7d/30d/90d. */
export function scoreMomentum(c: RawMarketCoin, period: MomentumPeriod): {
  score: number
  cls: MomentumClass
  reason: string
  strength: number
} {
  const { c7, c30, c90, c24 } = periodChanges(c)
  const cp =
    period === '24h' ? c24 : period === '7d' ? c7 : period === '30d' ? c30 : c90

  let score =
    period === '24h'
      ? 50 + clamp(cp * 1.25, -40, 40)
      : 50 + clamp(cp * 1.2, -35, 35) + clamp(c24 * 0.4, -10, 10)

  const accelerating =
    period === '24h'
      ? c24 > 4 && c24 >= (c7 / 7) * 1.2
      : period === '7d' && c7 > 4 && c24 > 1 && c24 >= c7 * 0.35
  const decelerating = cp < -5 && c24 < -1
  const reversal = cp < -8 && c24 > 4

  let cls: MomentumClass = 'estavel'
  let reason = `${c.symbol.toUpperCase()} mantém movimento lateral (${period}: ${cp >= 0 ? '+' : ''}${cp.toFixed(1)}%).`

  if (accelerating) {
    cls = 'acelerando'
    reason = `${c.symbol.toUpperCase()} apresenta aceleração positiva em ${period} (+${cp.toFixed(1)}%) com reforço nas últimas 24h.`
    score += 8
  } else if (reversal) {
    cls = 'reversao'
    reason = `Possível reversão em ${c.symbol.toUpperCase()}: recuperação 24h (+${c24.toFixed(1)}%) após queda de ${period}.`
  } else if (decelerating) {
    cls = 'fraco'
    reason = `${c.symbol.toUpperCase()} perde força em ${period} (${cp.toFixed(1)}%) com pressão vendedora recente.`
    score -= 10
  } else if (cp > 8) {
    cls = 'acelerando'
    reason = `${c.symbol.toUpperCase()} mantém tendência forte em ${period} (+${cp.toFixed(1)}%).`
  } else if (cp < -8) {
    cls = 'fraco'
    reason = `${c.symbol.toUpperCase()} enfraquece em ${period} (${cp.toFixed(1)}%).`
  }

  score = clamp(score, 0, 100)
  const strength = clamp(Math.abs(cp) + Math.abs(c24) * 0.5, 0, 100)
  return { score, cls, reason, strength }
}

/** Score 0–100 a partir de rácio volume/cap e anomalias. */
export function scoreVolume(c: RawMarketCoin): { score: number; abnormal: boolean; ratio: number } {
  const vol = c.total_volume ?? 0
  const mcap = c.market_cap ?? 0
  if (!mcap || !vol) return { score: 50, abnormal: false, ratio: 0 }

  const ratio = vol / mcap
  let score = 50
  if (ratio > 0.08) score += 15
  if (ratio > 0.15) score += 12
  if (ratio > 0.25) score += 10
  if (ratio < 0.03) score -= 12
  if (ratio < 0.015) score -= 8

  const abnormal = ratio > 0.22 || ratio < 0.012
  return { score: clamp(score, 0, 100), abnormal, ratio }
}

/** Score DeFi 0–100 por token (via gecko_id / symbol nos protocolos). */
export function scoreDefiForToken(
  c: RawMarketCoin,
  feesByGecko: Map<string, RawProtocolFees>,
  feesBySymbol: Map<string, RawProtocolFees>,
): number {
  const byGecko = feesByGecko.get(c.id)
  const bySym = feesBySymbol.get(c.symbol.toUpperCase())
  const p = byGecko ?? bySym
  if (!p) return 50

  let score = 52
  const chg = p.change_1d ?? 0
  if (chg > 5) score += 18
  else if (chg > 0) score += 10
  else if (chg < -10) score -= 18
  else if (chg < 0) score -= 8

  const rev = p.revenue24h ?? p.fees24h ?? 0
  if (rev > 1_000_000) score += 8
  if (rev > 10_000_000) score += 6

  return clamp(score, 0, 100)
}

/** Relevância de mercado: rank cap + trending + menções. */
export function scoreRelevance(
  c: RawMarketCoin,
  rank: number,
  trendingBoost: number,
  mentionCount: number,
): number {
  let score = 50
  if (rank <= 10) score += 22
  else if (rank <= 30) score += 14
  else if (rank <= 60) score += 6
  score += clamp(trendingBoost * 4, 0, 20)
  score += clamp(mentionCount * 3, 0, 18)
  return clamp(score, 0, 100)
}

export function computeTrimScore(subs: TrimSubScores): number {
  return clamp(
    Math.round(
      subs.momentum * TRIM_WEIGHTS.momentum +
        subs.volume * TRIM_WEIGHTS.volume +
        subs.news * TRIM_WEIGHTS.news +
        subs.defi * TRIM_WEIGHTS.defi +
        subs.relevance * TRIM_WEIGHTS.relevance,
    ),
    0,
    100,
  )
}

export function buildTokenTrimScores(input: {
  markets: RawMarketCoin[]
  trending: RawTrending[]
  tokenNewsScore: Map<string, number>
  tokenMentions: Map<string, number>
  feesByGecko: Map<string, RawProtocolFees>
  feesBySymbol: Map<string, RawProtocolFees>
  period: MomentumPeriod
}): Map<string, TrimTokenScores> {
  const trendingMap = new Map<string, number>()
  for (const t of input.trending) {
    trendingMap.set(t.symbol, t.score)
  }

  const out = new Map<string, TrimTokenScores>()

  input.markets.forEach((c, idx) => {
    const sym = c.symbol.toUpperCase()
    const mom = scoreMomentum(c, input.period)
    const vol = scoreVolume(c)
    const news = input.tokenNewsScore.get(sym) ?? 50
    const defi = scoreDefiForToken(c, input.feesByGecko, input.feesBySymbol)
    const relevance = scoreRelevance(
      c,
      idx + 1,
      trendingMap.get(sym) ?? 0,
      input.tokenMentions.get(sym) ?? 0,
    )

    const subs: TrimSubScores = {
      momentum: mom.score,
      volume: vol.score,
      news,
      defi,
      relevance,
    }
    const trimScore = computeTrimScore(subs)
    const trimClass = trimClassFromScore(trimScore)

    out.set(c.id, {
      ...subs,
      trimScore,
      trimClass,
      trimLabel: TRIM_CLASS_LABEL[trimClass],
      volumeScore: vol.score,
      momentumClass: mom.cls,
      momentumReason: mom.reason,
      strength: mom.strength,
    })
  })

  return out
}

export function marketTrimScore(scores: TrimTokenScores[]): number {
  if (!scores.length) return 50
  const top = [...scores].sort((a, b) => b.trimScore - a.trimScore).slice(0, 20)
  return Math.round(top.reduce((s, t) => s + t.trimScore, 0) / top.length)
}
