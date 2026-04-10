import {
  Pool,
  PoolAprPeriod,
  Protocol,
  PoolChartData,
  TokenPrice,
  SUPPORTED_CHAINS,
  PoolFilters,
} from './types'
import {
  aprPresetBounds,
  computePoolRiskLevel,
  getChainCategory,
  inferPoolTypes,
  isPrimaryDexProject,
  matchesVolumePreset,
  passesChainCategory,
  passesSafeAprProfile,
} from './pool-classification'
import { canonicalLlamaChain, normalizePoolChains } from './llama-chain'
import { poolTokenTickers } from './blue-chip-pools'
import { poolDisplayApr as poolDisplayAprFromLogic } from './pool-apr'

const DEFILLAMA_YIELDS = 'https://yields.llama.fi'
const DEFILLAMA_API = 'https://api.llama.fi'
const COINS_API = 'https://coins.llama.fi'

/** Base para chamadas às rotas internas (SSR / testes). No browser usa path relativo. */
function internalApiBase(): string {
  if (typeof window !== 'undefined') return ''
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
  )
}

function clientTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  const c = new AbortController()
  setTimeout(() => c.abort(), ms)
  return c.signal
}

/** Pools ingeridas da API DLMM da Meteora (não têm campos de série tipo DefiLlama). */
export function isMeteoraDlmmPool(pool: Pick<Pool, 'pool' | 'project'>): boolean {
  return pool.project === 'meteora-dlmm' || pool.pool.startsWith('meteora-dlmm-')
}

/** Após merge Llama+Meteora; alinhado ao cap máximo de `/api/pools` (12k). */
const POOLS_MERGE_CAP = 12_000

/** Amostra menor para dashboard/widgets — menos JSON e parse no cliente. */
export const DASHBOARD_POOLS_MIN_TVL = 25_000
export const DASHBOARD_POOLS_CAP = 4_000

export type FetchPoolsOptions = {
  /** Limite após merge (custos de rede/CPU no cliente). */
  cap?: number
  /** Meteora é opcional: desligar acelera o primeiro carregamento. Default true. */
  includeMeteora?: boolean
}

export const dashboardPoolsQueryKey = [
  'pools',
  'bundle',
  DASHBOARD_POOLS_MIN_TVL,
  DASHBOARD_POOLS_CAP,
] as const

/** DefiLlama só — resposta tipicamente antes da Meteora; o painel junta no cliente. */
export const dashboardPoolsLlamaQueryKey = [...dashboardPoolsQueryKey, 'llama'] as const

/** Meteora DLMM em pedido separado (não bloqueia o primeiro paint com dados Llama). */
export const dashboardPoolsMeteoraQueryKey = [...dashboardPoolsQueryKey, 'meteora'] as const

export function mergeDashboardPoolLists(llama: Pool[], meteora: Pool[] | undefined): Pool[] {
  if (!meteora?.length) return llama
  const seen = new Set(llama.map((p) => p.pool))
  const out = [...llama]
  for (const p of meteora) {
    if (!seen.has(p.pool)) {
      seen.add(p.pool)
      out.push(p)
    }
  }
  out.sort((a, b) => b.tvlUsd - a.tvlUsd)
  return out.slice(0, DASHBOARD_POOLS_CAP)
}

export async function fetchDashboardLlamaPools(): Promise<Pool[]> {
  return fetchPools(DASHBOARD_POOLS_MIN_TVL, {
    cap: DASHBOARD_POOLS_CAP,
    includeMeteora: false,
  })
}

/** Meteora para o dashboard: menos páginas que o pedido “completo” via fetchPools. */
export async function fetchDashboardMeteoraOnly(): Promise<Pool[]> {
  try {
    const base = internalApiBase()
    const q = encodeURIComponent(String(DASHBOARD_POOLS_MIN_TVL))
    const signal = clientTimeoutSignal(60_000)
    const metaRes = await fetch(`${base}/api/meteora-pools?minTvl=${q}&maxPages=8`, {
      signal,
    })
    if (!metaRes.ok) return []
    const mj = (await metaRes.json()) as { data?: Pool[] }
    return normalizePoolChains(mj.data ?? [])
  } catch {
    return []
  }
}

/** Bundle completo (Llama + Meteora em paralelo) — páginas que ainda precisem de um único queryFn. */
export function fetchDashboardPools(): Promise<Pool[]> {
  return fetchPools(DASHBOARD_POOLS_MIN_TVL, {
    cap: DASHBOARD_POOLS_CAP,
    includeMeteora: true,
  })
}

/** Meteora vs slug DefiLlama (`meteora`, `meteora-dlmm`, etc.): filtro por DEX deve aceitar ambos. */
function protocolMatchesSelection(pool: Pool, selected: Set<string>): boolean {
  if (selected.size === 0) return true
  if (selected.has(pool.project)) return true
  const proj = pool.project.toLowerCase()
  const poolIsMeteora = proj.includes('meteora')
  if (!poolIsMeteora) return false
  for (const s of selected) {
    if (s.toLowerCase().includes('meteora')) return true
  }
  return false
}

/**
 * DefiLlama (/api/pools) + Meteora (/api/meteora-pools) em paralelo — evita timeout do servidor
 * e trava “carregando para sempre” no celular.
 */
export async function fetchPools(
  minTvlUsd: number = 10_000,
  options?: FetchPoolsOptions
): Promise<Pool[]> {
  const includeMeteora = options?.includeMeteora !== false
  const mergeCap = Math.min(options?.cap ?? POOLS_MERGE_CAP, POOLS_MERGE_CAP)
  const q = encodeURIComponent(String(minTvlUsd))
  const llamaRequestCap =
    options?.cap != null ? Math.min(options.cap, 12_000) : 12_000
  const base = internalApiBase()
  const llamaUrl = `${base}/api/pools?minTvl=${q}&cap=${encodeURIComponent(String(llamaRequestCap))}`
  const metaPages = mergeCap >= 8000 ? 14 : 8
  const metaUrl = `${base}/api/meteora-pools?minTvl=${q}&maxPages=${encodeURIComponent(String(metaPages))}`
  const signal = clientTimeoutSignal(90_000)

  const [llamaRes, metaRes] = await Promise.all([
    fetch(llamaUrl, { signal }),
    includeMeteora ? fetch(metaUrl, { signal }).catch(() => null as Response | null) : Promise.resolve(null),
  ])

  if (!llamaRes.ok) {
    throw new Error('Não foi possível carregar pools (DefiLlama). Tente de novo.')
  }

  const llamaJson = (await llamaRes.json()) as { data?: Pool[] }
  let pools = llamaJson.data ?? []
  let meteoraMerged: Pool[] = []

  if (includeMeteora && metaRes?.ok) {
    try {
      const mj = (await metaRes.json()) as { data?: Pool[] }
      const meta = mj.data ?? []
      meteoraMerged = meta
      const seen = new Set(pools.map((p) => p.pool))
      for (const p of meta) {
        if (!seen.has(p.pool)) {
          seen.add(p.pool)
          pools.push(p)
        }
      }
    } catch {
      /* Meteora opcional */
    }
  }

  pools.sort((a, b) => b.tvlUsd - a.tvlUsd)
  pools = pools.slice(0, mergeCap)

  // Meteora vem de outra API; o slice global por TVL não pode remover todas as pools Meteora
  // (senão some o chip «Meteora» em Solana quando há Raydium/Orca).
  if (meteoraMerged.length > 0) {
    const keep = new Set(pools.map((p) => p.pool))
    for (const p of meteoraMerged) {
      if (!keep.has(p.pool) && p.project.toLowerCase().includes('meteora')) {
        pools.push(p)
        keep.add(p.pool)
      }
    }
  }

  return normalizePoolChains(pools)
}

// Fetch pool chart data (só DefiLlama; pools Meteora não têm série aqui)
export async function fetchPoolChart(poolId: string): Promise<PoolChartData[]> {
  if (poolId.startsWith('meteora-dlmm-')) return []
  const url = `${internalApiBase()}/api/yields-chart?poolId=${encodeURIComponent(poolId)}`
  const response = await fetch(url, { signal: clientTimeoutSignal(45_000) })
  if (!response.ok) return []
  const raw = await response.json()
  return Array.isArray(raw) ? raw : []
}

// Fetch all protocols
export async function fetchProtocols(): Promise<Protocol[]> {
  const response = await fetch(`${DEFILLAMA_API}/protocols`)
  if (!response.ok) throw new Error('Failed to fetch protocols')
  
  return response.json()
}

// Fetch token prices
export async function fetchTokenPrices(tokens: string[]): Promise<Record<string, TokenPrice>> {
  if (tokens.length === 0) return {}
  
  const tokenString = tokens.join(',')
  const response = await fetch(`${COINS_API}/prices/current/${tokenString}`)
  if (!response.ok) throw new Error('Failed to fetch token prices')
  
  const data = await response.json()
  return data.coins
}

// Fetch historical TVL by chain
export async function fetchHistoricalTvl(chain: string): Promise<{ date: number; tvl: number }[]> {
  const url = `${internalApiBase()}/api/historical-chain-tvl?chain=${encodeURIComponent(chain)}`
  const response = await fetch(url, { signal: clientTimeoutSignal(45_000) })
  if (!response.ok) return []
  return response.json()
}

// Fetch TVL for all chains
export async function fetchAllChainsTvl(): Promise<Record<string, number>> {
  const response = await fetch(`${internalApiBase()}/api/chains-tvl`, {
    signal: clientTimeoutSignal(45_000),
  })
  if (!response.ok) throw new Error('Failed to fetch chains TVL')
  return response.json()
}

// Format currency
export function formatCurrency(value: number, compact = true): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  if (compact) {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Format percentage
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number' && !Number.isFinite(value)) return '-'
  return `${value.toFixed(2)}%`
}

// Format number
export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Cor da taxa exibida (valor vem como `apy` na API DefiLlama; UI mostra como APR de pool.) */
export function getAprColorClass(rate: number): string {
  if (!Number.isFinite(rate)) return 'text-muted-foreground'
  if (rate >= 100) return 'text-destructive'
  if (rate >= 50) return 'text-gold'
  if (rate >= 20) return 'text-[#fcd34d]'
  if (rate >= 5) return 'text-foreground'
  return 'text-muted-foreground'
}

// Get change indicator
export function getChangeIndicator(change: number | null): { text: string; color: string } {
  if (change === null || change === undefined) {
    return { text: '-', color: 'text-muted-foreground' }
  }
  if (change > 0) {
    return { text: `+${change.toFixed(2)}%`, color: 'text-success' }
  }
  if (change < 0) {
    return { text: `${change.toFixed(2)}%`, color: 'text-destructive' }
  }
  return { text: '0.00%', color: 'text-muted-foreground' }
}

// Get chain color
export function getChainColor(chainId: string | null | undefined): string {
  if (chainId == null || chainId === '') {
    return 'hsl(210, 25%, 55%)'
  }
  const chain = SUPPORTED_CHAINS.find(c => c.id === chainId)
  if (chain) return chain.color
  let h = 0
  for (let i = 0; i < chainId.length; i++) {
    h = chainId.charCodeAt(i) + ((h << 5) - h)
  }
  const hue = Math.abs(h) % 360
  return `hsl(${hue}, 50%, 58%)`
}

// Get chain config
export function getChainConfig(chainId: string) {
  return SUPPORTED_CHAINS.find(c => c.id === chainId)
}

/** APR mostrado na tabela conforme o período (Llama + fallback taxas/TVL). */
export function poolDisplayApr(pool: Pool, period: PoolAprPeriod): number {
  return poolDisplayAprFromLogic(pool, period)
}

export function poolHasAprDataForPeriod(pool: Pool, period: PoolAprPeriod): boolean {
  if (period === 'current' || period === '5m' || period === '10m' || period === '1h') return true
  if (isMeteoraDlmmPool(pool)) {
    return true
  }
  switch (period) {
    case '1d':
      return pool.apyPct1D != null
    case '7d':
      return pool.apyBase7d != null || pool.apyPct7D != null
    case '30d':
      return pool.apyMean30d != null
    default:
      return true
  }
}

// Sort pools
export function sortPools(
  pools: Pool[],
  sortBy: string,
  direction: 'asc' | 'desc',
  period: PoolAprPeriod = 'current'
): Pool[] {
  return [...pools].sort((a, b) => {
    let valueA: number
    let valueB: number
    
    switch (sortBy) {
      case 'apr': {
        valueA = poolDisplayApr(a, period)
        valueB = poolDisplayApr(b, period)
        const fa = Number.isFinite(valueA)
        const fb = Number.isFinite(valueB)
        if (!fa && !fb) return 0
        if (!fa) return direction === 'desc' ? 1 : -1
        if (!fb) return direction === 'desc' ? -1 : 1
        break
      }
      case 'apy1d':
        valueA = a.apyPct1D ?? 0
        valueB = b.apyPct1D ?? 0
        break
      case 'apy7d':
        valueA = a.apyPct7D ?? 0
        valueB = b.apyPct7D ?? 0
        break
      case 'apy30d':
        valueA = a.apyMean30d ?? 0
        valueB = b.apyMean30d ?? 0
        break
      case 'tvl':
        valueA = a.tvlUsd ?? 0
        valueB = b.tvlUsd ?? 0
        break
      case 'volume':
        valueA = a.volumeUsd1d ?? 0
        valueB = b.volumeUsd1d ?? 0
        break
      case 'change7d':
        valueA = a.apyPct7D ?? 0
        valueB = b.apyPct7D ?? 0
        break
      default: {
        valueA = poolDisplayApr(a, period)
        valueB = poolDisplayApr(b, period)
        const fa = Number.isFinite(valueA)
        const fb = Number.isFinite(valueB)
        if (!fa && !fb) return 0
        if (!fa) return direction === 'desc' ? 1 : -1
        if (!fb) return direction === 'desc' ? -1 : 1
        break
      }
    }

    return direction === 'desc' ? valueB - valueA : valueA - valueB
  })
}

/** Expande nomes comuns → tickers usados em pares (Meteora, Llama, etc.). */
function expandedPoolSearchTerms(token: string): string[] {
  const t = token.trim().toLowerCase()
  if (!t) return []
  const terms = new Set<string>([t])
  const ALIASES: Record<string, string[]> = {
    bitcoin: ['btc', 'wbtc', 'cbbtc'],
    btc: ['bitcoin', 'wbtc', 'cbbtc'],
    wbtc: ['btc', 'bitcoin', 'cbbtc'],
    cbbtc: ['btc', 'bitcoin', 'wbtc'],
    ethereum: ['eth', 'weth'],
    eth: ['ethereum', 'weth'],
    weth: ['eth', 'ethereum'],
    solana: ['sol', 'wsol'],
    sol: ['solana', 'wsol'],
    wsol: ['sol', 'solana'],
    usd: ['usdc', 'usdt', 'dai'],
    stable: ['usdc', 'usdt', 'dai', 'pyusd'],
    tether: ['usdt'],
    'usd coin': ['usdc'],
  }
  for (const x of ALIASES[t] ?? []) terms.add(x)
  return [...terms]
}

function poolMatchesSearchTerms(pool: Pool, terms: string[]): boolean {
  if (terms.length === 0) return true
  const sym = (pool.symbol ?? '').toLowerCase()
  const proj = (pool.project ?? '').toLowerCase()
  const tickers = poolTokenTickers(pool).map((x) => x.toLowerCase())
  return terms.some(
    (term) =>
      sym.includes(term) ||
      proj.includes(term) ||
      tickers.some((tk) => tk === term || tk.includes(term) || term.includes(tk))
  )
}

/**
 * Busca por um token (ex.: `btc`, `bitcoin`) ou par com barra (ex.: `BTC/USDT`, `wbtc-usdt`).
 * Compara símbolo da pool sem exigir o caractere `/` literal no nome.
 */
export function poolMatchesSearchQuery(pool: Pool, rawSearch: string): boolean {
  const q = rawSearch.trim()
  if (!q) return true

  const parts = q
    .split(/[/\\|／]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  if (parts.length >= 2) {
    return parts.every((tok) => poolMatchesSearchTerms(pool, expandedPoolSearchTerms(tok)))
  }

  const terms = expandedPoolSearchTerms(q.toLowerCase())
  return poolMatchesSearchTerms(pool, terms)
}

// Filter pools
export function filterPools(
  pools: Pool[],
  filters: PoolFilters,
  period: PoolAprPeriod = 'current'
): Pool[] {
  const selectedProtocols = filters.protocols.length ? new Set(filters.protocols) : null

  return pools.filter((pool) => {
    if (period !== 'current' && !poolHasAprDataForPeriod(pool, period)) return false

    if (filters.search) {
      if (!poolMatchesSearchQuery(pool, filters.search)) return false
    }

    const poolChain = canonicalLlamaChain(pool.chain)
    const explicitNetworks = filters.chains.length > 0
    if (explicitNetworks) {
      const selected = new Set(filters.chains.map((c) => canonicalLlamaChain(c)))
      if (!selected.has(poolChain)) return false
    } else {
      if (!passesChainCategory(pool, filters.chainCategory)) return false
    }
    // Com chips de rede selecionados, o ramo acima ignora chainCategory; força blue chip quando ativo.
    if (filters.chainCategory === 'safe' && getChainCategory(pool.chain) !== 'safe') return false

    if (selectedProtocols && !protocolMatchesSelection(pool, selectedProtocols)) return false

    if (filters.primaryDexOnly && !isPrimaryDexProject(pool.project)) return false

    let displayApr = poolDisplayApr(pool, period)
    if (!Number.isFinite(displayApr)) {
      displayApr = Math.min(Math.max(0, pool.apy ?? 0), 300)
    }
    const presetBounds = aprPresetBounds(filters.aprPreset)
    const aprLo = presetBounds?.min ?? filters.aprMin
    const aprHi = presetBounds?.max ?? filters.aprMax
    if (displayApr < aprLo || displayApr > aprHi) return false

    if (filters.riskLevel !== 'all') {
      if (computePoolRiskLevel(pool, displayApr) !== filters.riskLevel) return false
    }

    if (!matchesVolumePreset(pool, filters.volumePreset)) return false

    if (filters.poolTypes.length > 0) {
      const types = inferPoolTypes(pool)
      if (!filters.poolTypes.some((t) => types.includes(t))) return false
    }

    if (pool.tvlUsd < filters.tvlMin) return false

    if (filters.ilRisk !== 'all' && pool.ilRisk !== filters.ilRisk) return false

    if (filters.exposure !== 'all' && pool.exposure !== filters.exposure) return false

    if (filters.stablecoinOnly && !pool.stablecoin) return false

    if (filters.safeAprProfile && !passesSafeAprProfile(pool, displayApr)) return false

    return true
  })
}
