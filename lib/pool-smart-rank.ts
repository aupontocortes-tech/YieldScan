import type { Pool, PoolAprPeriod, PoolFilters } from './types'
import { poolDisplayApr } from './api'
import { computePoolRiskLevel } from './pool-classification'
import { SAFE_CHAINS } from './pool-classification'
import { canonicalLlamaChain } from './llama-chain'
import { matchesCuratedDex, poolMatchesSelectedChains } from './curated-markets'

export type SmartFilterFlags = {
  highApr: boolean
  highTvl: boolean
  lowRisk: boolean
}

/** Score para “Melhores oportunidades” e ordenação inteligente (maior = melhor). */
export function poolSmartScore(pool: Pool, period: PoolAprPeriod, flags: SmartFilterFlags): number {
  const apr = poolDisplayApr(pool, period)
  const cappedApr = Math.min(Math.max(apr, 0), 500)
  const tvl = pool.tvlUsd ?? 0
  const vol = pool.volumeUsd1d ?? 0
  const logTvl = Math.log10(tvl + 1)
  const logVol = Math.log10(vol + 1)

  let s = 0
  if (flags.highApr) s += cappedApr * 1.2
  if (flags.highTvl) s += logTvl * 42
  if (flags.lowRisk) {
    const risk = computePoolRiskLevel(pool, apr)
    if (risk === 'low') s += 95
    else if (risk === 'medium') s += 40
    if (SAFE_CHAINS.has(canonicalLlamaChain(pool.chain))) s += 22
    if (pool.stablecoin) s += 15
  }

  if (!flags.highApr && !flags.highTvl && !flags.lowRisk) {
    return cappedApr * 0.35 + logTvl * 28 + logVol * 18
  }

  return s
}

export function pickTopOpportunityPools(
  pools: Pool[],
  period: PoolAprPeriod,
  n: number
): Pool[] {
  return [...pools]
    .filter((p) => p.apy > 0 && p.apy < 8000 && p.tvlUsd >= 25_000)
    .map((p) => ({
      p,
      score: poolSmartScore(p, period, { highApr: true, highTvl: true, lowRisk: false }),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.p)
}

export function sortPoolsWithSmartPriority(
  pools: Pool[],
  period: PoolAprPeriod,
  flags: SmartFilterFlags,
  sortBy: PoolFilters['sortBy'],
  sortDirection: 'asc' | 'desc',
  sortFn: (
    pools: Pool[],
    sortBy: PoolFilters['sortBy'],
    dir: 'asc' | 'desc',
    period: PoolAprPeriod
  ) => Pool[]
): Pool[] {
  const anySmart = flags.highApr || flags.highTvl || flags.lowRisk
  if (!anySmart) {
    return sortFn(pools, sortBy, sortDirection, period)
  }
  return [...pools].sort(
    (a, b) => poolSmartScore(b, period, flags) - poolSmartScore(a, period, flags)
  )
}

export type ProtocolAgg = {
  project: string
  totalTvl: number
  totalVol: number
  aprSum: number
  count: number
}

export function aggregateProtocols(
  pools: Pool[],
  selectedChains: string[],
  options: { curatedOnly: boolean; aprOf: (p: Pool) => number }
): ProtocolAgg[] {
  const map = new Map<string, ProtocolAgg>()
  for (const pool of pools) {
    if (!poolMatchesSelectedChains(pool, selectedChains)) continue
    if (options.curatedOnly && !matchesCuratedDex(pool.chain, pool.project)) continue
    const key = pool.project
    const prev = map.get(key) ?? {
      project: key,
      totalTvl: 0,
      totalVol: 0,
      aprSum: 0,
      count: 0,
    }
    prev.totalTvl += pool.tvlUsd ?? 0
    prev.totalVol += pool.volumeUsd1d ?? 0
    prev.aprSum += options.aprOf(pool)
    prev.count += 1
    map.set(key, prev)
  }
  return [...map.values()].sort((a, b) => {
    if (b.totalTvl !== a.totalTvl) return b.totalTvl - a.totalTvl
    if (b.totalVol !== a.totalVol) return b.totalVol - a.totalVol
    const avgA = a.count ? a.aprSum / a.count : 0
    const avgB = b.count ? b.aprSum / b.count : 0
    return avgB - avgA
  })
}

export function topPoolIdsBySmartScore(
  pools: Pool[],
  period: PoolAprPeriod,
  flags: SmartFilterFlags,
  take: number
): Set<string> {
  if (!flags.highApr && !flags.highTvl && !flags.lowRisk) return new Set()
  const ranked = [...pools]
    .map((p) => ({ p, s: poolSmartScore(p, period, flags) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, take)
  return new Set(ranked.map((x) => x.p.pool))
}
