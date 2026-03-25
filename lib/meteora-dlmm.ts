import type { Pool } from './types'

const METEORA_DLMM_API = 'https://dlmm.datapi.meteora.ag'

export interface MeteoraDlmmPoolRow {
  address: string
  name: string
  tvl: number
  apy: number
  apr: number
  has_farm?: boolean
  farm_apy?: number
  farm_apr?: number
  volume?: { '24h'?: number }
  pool_config?: { base_fee_pct?: number; dynamic_fee_pct?: number }
  token_x?: { address?: string; symbol?: string }
  token_y?: { address?: string; symbol?: string }
  is_blacklisted?: boolean
}

interface MeteoraListResponse {
  data: MeteoraDlmmPoolRow[]
}

/** APY absurdo da API → usar APR de taxas como fallback. */
function sanitizeApy(apy: number | undefined, apr: number | undefined): number {
  if (typeof apy === 'number' && Number.isFinite(apy) && apy >= 0 && apy <= 5000) return apy
  if (typeof apr === 'number' && Number.isFinite(apr) && apr >= 0 && apr <= 50) {
    return Math.min(apr * 365 * 100, 5000)
  }
  if (typeof apr === 'number' && Number.isFinite(apr) && apr >= 0) return Math.min(apr * 100, 999)
  return 0
}

export function mapMeteoraRowToPool(row: MeteoraDlmmPoolRow): Pool {
  const farmReward = row.has_farm ? sanitizeApy(row.farm_apy, row.farm_apr) : 0
  const apy = sanitizeApy(row.apy, row.apr)
  const apyBase = Math.max(0, apy - farmReward)
  const vol = row.volume?.['24h']
  const feeParts: string[] = []
  if (row.pool_config?.base_fee_pct != null) feeParts.push(`base ${row.pool_config.base_fee_pct}%`)
  if (row.pool_config?.dynamic_fee_pct != null) feeParts.push(`din ${row.pool_config.dynamic_fee_pct}%`)

  return {
    pool: `meteora-dlmm-${row.address}`,
    symbol: row.name || 'DLMM',
    project: 'meteora-dlmm',
    chain: 'Solana',
    apy,
    apyBase,
    apyReward: row.has_farm ? farmReward : null,
    apyBase7d: null,
    apyMean30d: null,
    apyPct1D: null,
    apyPct7D: null,
    apyPct30D: null,
    tvlUsd: row.tvl,
    volumeUsd1d: vol ?? null,
    volumeUsd7d: null,
    ilRisk: 'yes',
    exposure: 'multi',
    stablecoin: /\b(USDC|USDT|DAI|USD|PYUSD|USDS)\b/i.test(row.name),
    rewardTokens: null,
    url: `https://app.meteora.ag/dlmm/${row.address}`,
    underlyingTokens: [row.token_x?.address, row.token_y?.address].filter(Boolean) as string[],
    poolMeta: feeParts.length ? feeParts.join(' · ') : 'Meteora DLMM',
  }
}

export async function fetchMeteoraDlmmPools(options: {
  minTvlUsd: number
  maxPages?: number
  pageSize?: number
}): Promise<Pool[]> {
  const { minTvlUsd, maxPages = 14, pageSize = 100 } = options
  const out: Pool[] = []

  for (let page = 1; page <= maxPages; page++) {
    const u = new URL(`${METEORA_DLMM_API}/pools`)
    u.searchParams.set('page', String(page))
    u.searchParams.set('page_size', String(pageSize))

    const res = await fetch(u.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 120 },
    })
    if (!res.ok) break

    const json = (await res.json()) as MeteoraListResponse
    const rows = json.data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      if (row.is_blacklisted) continue
      if (row.tvl < minTvlUsd) continue
      out.push(mapMeteoraRowToPool(row))
    }
  }

  return out
}
