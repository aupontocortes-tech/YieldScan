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

export async function fetchDefillamaEmissions(): Promise<{
  data: DefillamaEmissionToken[]
  error?: string
}> {
  const url = getDefillamaProUrl('/api/emissions')
  if (!url) {
    return {
      data: [],
      error: 'DEFILLAMA_PRO_API_KEY não configurada. Desbloqueios requerem DefiLlama Pro.',
    }
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(45_000),
    })

    if (res.status === 402 || res.status === 401) {
      return {
        data: [],
        error: 'DefiLlama Pro: chave inválida ou plano sem acesso a emissions.',
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
