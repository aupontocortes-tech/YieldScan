import type { Pool } from './types'

/**
 * Tier de fee de swap/LP quando `poolMeta` da DefiLlama traz (ex.: Uniswap v3: "0,3%").
 * Não confunde com taxas de staking/rewards (epoch fee, etc.).
 */
export function getPoolSwapFeeLabel(pool: Pool): string | null {
  const meta = pool.poolMeta?.trim()
  if (!meta) return null

  if (/epoch|rewards?\s+fee|staking|validator|commission/i.test(meta)) {
    return null
  }

  if (meta.length > 36 && !/^(\d+(?:\.\d+)?)\s*%$/.test(meta) && !/concentrated/i.test(meta)) {
    return null
  }

  const conc = meta.match(/concentrated\s*-\s*(\d+(?:\.\d+)?)\s*%/i)
  if (conc) return `${conc[1]}%`

  if (/^(\d+(?:\.\d+)?)\s*%$/.test(meta)) return meta

  const m = meta.match(/(\d+(?:\.\d+)?)\s*%/)
  if (!m) return null

  const v = parseFloat(m[1]!)
  if (v > 100) return null

  const common = [0.01, 0.05, 0.1, 0.25, 0.3, 0.5, 1, 1.25, 2, 3, 5, 10, 30, 100]
  const isTier = common.some((t) => Math.abs(v - t) < 1e-6) || v < 2
  if (!isTier && v >= 2) return null

  return `${m[1]}%`
}

/** Texto curto quando há `poolMeta` mas não usamos como badge de fee de swap. */
export function getPoolMetaHint(pool: Pool): string | null {
  const meta = pool.poolMeta?.trim()
  if (!meta) return null
  if (getPoolSwapFeeLabel(pool)) return null
  return meta.length > 48 ? `${meta.slice(0, 45)}…` : meta
}
