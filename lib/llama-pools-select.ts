import type { Pool } from './types'
import { PREFERRED_CHAINS } from './pool-classification'

/**
 * Limita quantidade de pools (memória no celular) e prioriza redes em foco + maior TVL.
 */
export function selectLlamaPools(raw: Pool[], minTvlUsd: number, cap: number): Pool[] {
  const eligible = raw.filter(
    (p) => p.tvlUsd >= minTvlUsd && p.apy !== null && p.apy !== undefined
  )
  const preferred = eligible
    .filter((p) => PREFERRED_CHAINS.has(p.chain))
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
  const rest = eligible
    .filter((p) => !PREFERRED_CHAINS.has(p.chain))
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
  return [...preferred, ...rest].slice(0, cap)
}
