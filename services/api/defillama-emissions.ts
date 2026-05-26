import { getDefillamaProUrl } from '@/lib/defillama-server'

export type DefillamaEmissionEvent = {
  description?: string
  timestamp?: number
  noOfTokens?: number[]
  category?: string
  unlockType?: string
}

export type DefillamaEmissionToken = {
  token?: string
  name?: string
  gecko_id?: string | null
  protocolId?: string
  circSupply?: number
  circSupply30d?: number
  totalLocked?: number
  maxSupply?: number
  mcap?: number
  unlocksPerDay?: number
  events?: DefillamaEmissionEvent[]
  nextEvent?: {
    date?: number
    toUnlock?: number
  }
}

async function fetchFromUrl(url: string): Promise<{
  data: DefillamaEmissionToken[]
  error?: string
}> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(45_000),
    })

    if (res.status === 402 || res.status === 401) {
      return {
        data: [],
        error: 'DefiLlama: chave inválida ou plano sem acesso a emissions.',
      }
    }

    if (!res.ok) {
      return {
        data: [],
        error: `DefiLlama emissions HTTP ${res.status}`,
      }
    }

    const raw = (await res.json()) as DefillamaEmissionToken[] | { data?: DefillamaEmissionToken[] }
    const data = Array.isArray(raw) ? raw : (raw.data ?? [])
    return { data }
  } catch {
    return { data: [], error: 'DefiLlama emissions indisponível (timeout ou rede).' }
  }
}

const FREE_EMISSIONS_URL = 'https://api.llama.fi/emissions'

export type DefillamaProtocolEmission = {
  name?: string
  gecko_id?: string
  token?: string
  events?: DefillamaEmissionEvent[]
  nextEvent?: { date?: number; toUnlock?: number }
  sources?: string[]
  categoriesBreakdown?: Record<string, { current?: number; total?: number }>
  hallmarks?: Array<{ date?: number; label?: string }>
  tokenAllocation?: { current?: number; max?: number }
  circSupply?: number
  maxSupply?: number
  totalLocked?: number
  mcap?: number
  unlocksPerDay?: number
}

const TOP_EMISSION_PROTOCOLS = [
  'bitcoin', 'ripple', 'hyperliquid', 'binancecoin', 'mantle',
  'whitebit', 'pi-network', 'rainmaker-games', 'sui', 'tether',
  'the-open-network', 'aptos', 'arbitrum', 'optimism', 'starknet',
  'celestia', 'eigenlayer', 'pyth-network', 'jupiter-exchange-solana',
  'sei-network', 'solana', 'avalanche-2',
]

async function fetchProtocolEmission(protocol: string): Promise<DefillamaEmissionToken | null> {
  try {
    const res = await fetch(`https://api.llama.fi/emission/${encodeURIComponent(protocol)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const raw = (await res.json()) as DefillamaProtocolEmission
    if (!raw) return null
    return {
      token: raw.token ?? `coingecko:${protocol}`,
      name: raw.name ?? protocol,
      gecko_id: raw.gecko_id ?? protocol,
      events: raw.events,
      nextEvent: raw.nextEvent,
      circSupply: raw.circSupply ?? raw.tokenAllocation?.current ?? undefined,
      maxSupply: raw.maxSupply ?? raw.tokenAllocation?.max ?? undefined,
      totalLocked: raw.totalLocked,
      mcap: raw.mcap,
      unlocksPerDay: raw.unlocksPerDay,
    }
  } catch {
    return null
  }
}

async function fetchFreeProtocolEmissions(): Promise<DefillamaEmissionToken[]> {
  const results = await Promise.allSettled(
    TOP_EMISSION_PROTOCOLS.map((p) => fetchProtocolEmission(p))
  )
  return results
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((t): t is DefillamaEmissionToken => t != null)
}

export async function fetchDefillamaEmissions(): Promise<{
  data: DefillamaEmissionToken[]
  error?: string
}> {
  const proUrl = getDefillamaProUrl('/api/emissions')
  if (proUrl) {
    const result = await fetchFromUrl(proUrl)
    if (result.data.length > 0) return result
  }

  const freeResult = await fetchFromUrl(FREE_EMISSIONS_URL)
  if (freeResult.data.length > 0) return freeResult

  const protocolData = await fetchFreeProtocolEmissions()
  if (protocolData.length > 0) return { data: protocolData }

  return {
    data: [],
    error: proUrl
      ? 'DefiLlama Pro retornou vazio e API free também falhou.'
      : 'DefiLlama free API sem dados. Configura DEFILLAMA_PRO_API_KEY para acesso completo.',
  }
}

export function extractGeckoId(token: DefillamaEmissionToken): string | null {
  if (token.gecko_id?.trim()) return token.gecko_id.trim()
  const t = token.token ?? ''
  const prefix = 'coingecko:'
  if (t.startsWith(prefix)) return t.slice(prefix.length).trim() || null
  return null
}

export function sumEventTokens(event: DefillamaEmissionEvent): number {
  const parts = event.noOfTokens ?? []
  return parts.reduce((a, b) => a + (typeof b === 'number' && Number.isFinite(b) ? b : 0), 0)
}
