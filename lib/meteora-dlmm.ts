import type { Pool } from './types'
import { calculateAPR } from './pool-apr'

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

function meteoraFeeImpliedApr24h(row: MeteoraDlmmPoolRow): number {
  const vol = row.volume?.['24h'] ?? 0
  const tvl = row.tvl ?? 0
  const base = row.pool_config?.base_fee_pct ?? 0
  const dyn = row.pool_config?.dynamic_fee_pct ?? 0
  const feePct = (base + dyn) / 100
  if (vol <= 0 || tvl <= 0 || feePct <= 0) return 0
  return calculateAPR({ fees: vol * feePct, tvl, hours: 24 })
}

/**
 * Meteora envia `apr`/`apy` muitas vezes já como % anual (ex.: 85 = 85%).
 * Nunca multiplicar `apr` por 100 — isso gerava 800–999% falsos.
 */
function sanitizeApy(
  apy: number | undefined,
  apr: number | undefined,
  row: MeteoraDlmmPoolRow
): number {
  const feeCap = meteoraFeeImpliedApr24h(row)
  const a = typeof apy === 'number' && Number.isFinite(apy) && apy >= 0 ? apy : NaN
  const r = typeof apr === 'number' && Number.isFinite(apr) && apr >= 0 ? apr : NaN

  let out = Number.isFinite(a) ? a : 0
  if (Number.isFinite(r)) {
    if (r <= 500) {
      const fromApr = r
      if (!Number.isFinite(a) || a <= 0) out = fromApr
      else out = Math.min(a, fromApr)
    } else if (r < 1 && r > 0) {
      out = Number.isFinite(a) ? Math.min(a, r * 365 * 100) : r * 365 * 100
    }
  }

  if (feeCap > 0) {
    const hi = Math.max(feeCap * 2.75, feeCap + 25)
    out = Math.min(out, hi)
  }
  if (out > 500) out = feeCap > 0 ? Math.min(out, feeCap * 2.5) : 300
  if (!Number.isFinite(out) || out < 0) out = 0
  return out
}

export function mapMeteoraRowToPool(row: MeteoraDlmmPoolRow): Pool {
  const farmReward = row.has_farm ? sanitizeApy(row.farm_apy, row.farm_apr, row) : 0
  const apy = sanitizeApy(row.apy, row.apr, row)
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
  const pages = Array.from({ length: maxPages }, (_, i) => i + 1)
  return fetchMeteoraDlmmPoolsParallel({ minTvlUsd, pages, pageSize })
}

/** Várias páginas em paralelo (muito mais rápido que sequencial no servidor). */
export async function fetchMeteoraDlmmPoolsParallel(options: {
  minTvlUsd: number
  pages: number[]
  pageSize?: number
  perRequestMs?: number
}): Promise<Pool[]> {
  const { minTvlUsd, pages, pageSize = 100, perRequestMs = 10000 } = options
  const pageResults = await Promise.all(
    pages.map(async (page) => {
      const u = new URL(`${METEORA_DLMM_API}/pools`)
      u.searchParams.set('page', String(page))
      u.searchParams.set('page_size', String(pageSize))
      try {
        const res = await fetch(u.toString(), {
          headers: { Accept: 'application/json' },
          next: { revalidate: 120 },
          signal: AbortSignal.timeout(perRequestMs),
        })
        if (!res.ok) return [] as MeteoraDlmmPoolRow[]
        const json = (await res.json()) as MeteoraListResponse
        return json.data ?? []
      } catch {
        return [] as MeteoraDlmmPoolRow[]
      }
    })
  )

  const out: Pool[] = []
  const seenAddr = new Set<string>()
  for (const rows of pageResults) {
    for (const row of rows) {
      if (row.is_blacklisted || row.tvl < minTvlUsd) continue
      const p = mapMeteoraRowToPool(row)
      if (seenAddr.has(p.pool)) continue
      seenAddr.add(p.pool)
      out.push(p)
    }
  }
  return out
}
