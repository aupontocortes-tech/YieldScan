import type { Pool } from './types'

function poolMetaDisallowsImpliedFee(pool: Pool): boolean {
  const m = pool.poolMeta?.trim()
  if (!m) return false
  return /epoch|rewards?\s+fee|staking|validator|commission/i.test(m)
}

/**
 * Quando `poolMeta` não traz tier (comum em Orca e outras na DefiLlama), estima a taxa de swap
 * implícita: apyBase ≈ 365 × (volume24h × fee) / TVL → fee% ≈ apyBase × TVL / (365 × volume).
 * Só para pools com volume/TVL/base positivos e valor plausível (evita lending mal etiquetado).
 */
function computeImpliedSwapFeePercent(pool: Pool): number | null {
  const vol = pool.volumeUsd1d
  const tvl = pool.tvlUsd
  const base = typeof pool.apyBase === 'number' && Number.isFinite(pool.apyBase) ? pool.apyBase : 0
  if (vol == null || vol <= 0 || tvl <= 0 || base <= 0) return null
  const feePct = (base * tvl) / (365 * vol)
  if (!Number.isFinite(feePct) || feePct <= 0 || feePct > 20) return null
  return feePct
}

function formatSwapFeePercent(feePct: number): string {
  if (feePct < 0.02) return `${Math.round(feePct * 1000) / 1000}%`
  return `${Math.round(feePct * 100) / 100}%`
}

/**
 * Tier de fee de swap/LP quando `poolMeta` da DefiLlama traz (ex.: Uniswap v3: "0,3%").
 * Não confunde com taxas de staking/rewards (epoch fee, etc.).
 */
function parseSwapFeeFromPoolMeta(metaRaw: string | null | undefined): string | null {
  const meta = metaRaw?.trim()
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

export function getPoolSwapFeeLabel(pool: Pool): string | null {
  const fromMeta = parseSwapFeeFromPoolMeta(pool.poolMeta)
  if (fromMeta) return fromMeta
  if (poolMetaDisallowsImpliedFee(pool)) return null
  const impliedPct = computeImpliedSwapFeePercent(pool)
  if (impliedPct != null) return formatSwapFeePercent(impliedPct)
  return null
}

/** Texto curto quando há `poolMeta` mas não usamos como badge de fee de swap. */
export function getPoolMetaHint(pool: Pool): string | null {
  const meta = pool.poolMeta?.trim()
  if (!meta) return null
  if (parseSwapFeeFromPoolMeta(pool.poolMeta)) return null
  if (computeImpliedSwapFeePercent(pool) != null && !poolMetaDisallowsImpliedFee(pool)) return null
  return meta.length > 48 ? `${meta.slice(0, 45)}…` : meta
}
