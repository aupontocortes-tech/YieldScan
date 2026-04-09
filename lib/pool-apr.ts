import type { Pool, PoolAprPeriod } from './types'
import { getPoolSwapFeeLabel } from './pool-fee'

/** Horas por período do seletor (5m ≈ 0.0833h, 10m ≈ 0.1666h). Referência extra: 5h = 5. */
export const APR_PERIOD_HOURS: Record<PoolAprPeriod, number> = {
  '5m': 5 / 60,
  '10m': 10 / 60,
  '1h': 1,
  '1d': 24,
  '7d': 168,
  '30d': 720,
  current: 24,
}

export function calculateAPR(args: { fees: number; tvl: number; hours: number }): number {
  const { fees, tvl, hours } = args
  if (!fees || !tvl || tvl === 0 || !hours || hours <= 0) return 0
  if (!Number.isFinite(fees) || !Number.isFinite(tvl)) return 0
  const yearlyFactor = (365 * 24) / hours
  return (fees / tvl) * yearlyFactor * 100
}

function parseSwapFeeFraction(pool: Pool): number {
  const label = getPoolSwapFeeLabel(pool)
  if (!label) return 0
  const m = label.match(/(\d+(?:\.\d+)?)\s*%/)
  if (!m) return 0
  const v = parseFloat(m[1]!)
  if (!Number.isFinite(v) || v <= 0 || v > 100) return 0
  return v / 100
}

/** Taxas USD estimadas em 24h (volume × fee de swap do meta). */
export function poolEstimatedDailyFeesUsd(pool: Pool): number {
  const vol = pool.volumeUsd1d ?? 0
  const f = parseSwapFeeFraction(pool)
  if (vol <= 0 || f <= 0) return 0
  return vol * f
}

export function poolFeeImpliedAprFrom24h(pool: Pool): number {
  const tvl = pool.tvlUsd ?? 0
  const daily = poolEstimatedDailyFeesUsd(pool)
  if (tvl <= 0 || daily <= 0) return 0
  return calculateAPR({ fees: daily, tvl, hours: 24 })
}

function apiAprComponentsSum(pool: Pool): number {
  const base = typeof pool.apyBase === 'number' && Number.isFinite(pool.apyBase) ? pool.apyBase : 0
  const rew = typeof pool.apyReward === 'number' && Number.isFinite(pool.apyReward) ? pool.apyReward : 0
  return Math.max(0, base + rew)
}

function discardIfAbsurd(apr: number): number {
  if (!Number.isFinite(apr)) return NaN
  if (apr <= 0) return 0
  if (apr > 1000) return NaN
  return apr
}

/**
 * APR exibida por período: prioriza apyBase+apyReward quando crível;
 * senão recua para taxas × TVL; 7d/30d usam campos Llama quando existem.
 */
export function poolDisplayApr(pool: Pool, period: PoolAprPeriod): number {
  const hours = APR_PERIOD_HOURS[period]
  const tvl = pool.tvlUsd ?? 0
  const dailyFees = poolEstimatedDailyFeesUsd(pool)
  const feeApr24 = poolFeeImpliedAprFrom24h(pool)

  if (period === '7d') {
    const b7 = pool.apyBase7d
    if (typeof b7 === 'number' && Number.isFinite(b7) && b7 > 0 && b7 <= 500) {
      const rew =
        typeof pool.apyReward === 'number' && Number.isFinite(pool.apyReward) ? pool.apyReward : 0
      const v = Math.min(b7 + rew, 500)
      return discardIfAbsurd(softCapWithFees(v, feeApr24))
    }
    if (tvl > 0 && dailyFees > 0) {
      const apr = calculateAPR({ fees: dailyFees * 7, tvl, hours: 168 })
      return discardIfAbsurd(softCapWithFees(apr || apiAprComponentsSum(pool), feeApr24))
    }
    return discardIfAbsurd(softCapWithFees(apiAprComponentsSum(pool), feeApr24))
  }

  if (period === '30d') {
    const m30 = pool.apyMean30d
    if (typeof m30 === 'number' && Number.isFinite(m30) && m30 > 0 && m30 <= 500) {
      return discardIfAbsurd(softCapWithFees(m30, feeApr24))
    }
    if (tvl > 0 && dailyFees > 0) {
      const apr = calculateAPR({ fees: dailyFees * 30, tvl, hours: 720 })
      return discardIfAbsurd(softCapWithFees(apr || apiAprComponentsSum(pool), feeApr24))
    }
    return discardIfAbsurd(softCapWithFees(apiAprComponentsSum(pool), feeApr24))
  }

  const feesWindow = dailyFees * (hours / 24)
  const feeAprPeriod =
    tvl > 0 && feesWindow > 0 ? calculateAPR({ fees: feesWindow, tvl, hours }) : feeApr24

  const sum = apiAprComponentsSum(pool)
  const headline =
    typeof pool.apy === 'number' && Number.isFinite(pool.apy) ? Math.max(0, pool.apy) : sum

  let candidate: number
  const apiTrustMax = feeApr24 > 0 ? Math.max(300, feeApr24 * 4) : 320
  if (sum > 0 && sum <= 1000 && sum <= apiTrustMax) {
    candidate = sum
  } else if (feeAprPeriod > 0) {
    candidate = Math.min(headline > 0 ? headline : sum, Math.max(feeAprPeriod, feeApr24))
    if (headline > 300 && feeAprPeriod > 0) candidate = Math.min(candidate, feeAprPeriod * 2.5)
  } else {
    candidate = Math.min(headline, 300)
  }

  if (period === '1d' && typeof pool.apyPct1D === 'number' && Number.isFinite(pool.apyPct1D)) {
    const adj = candidate * (1 + pool.apyPct1D / 100)
    candidate = Math.min(adj, candidate * 1.5)
  }

  return discardIfAbsurd(softCapWithFees(candidate, feeApr24))
}

function softCapWithFees(apr: number, feeApr24: number): number {
  if (!Number.isFinite(apr) || apr <= 0) return apr
  if (apr > 300 && feeApr24 > 0) return Math.min(apr, feeApr24 * 3)
  return apr
}
