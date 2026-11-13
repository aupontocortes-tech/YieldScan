import { fetchCoingecko } from '@/lib/coingecko-server'
import { COINGECKO_LOGO_BY_ID } from '@/lib/coingecko-static-logos'
import type { RawMarketCoin } from '@/lib/tendencias/fetch-data'

export type RawCgCategory = {
  id: string
  name: string
  marketCap: number | null
  marketCapChange24h: number | null
  volume24h: number | null
}

const UA = 'yieldscan-tendencias/1'

async function cgJson<T>(path: string, timeoutMs = 14_000): Promise<T | null> {
  try {
    const res = await fetchCoingecko(path, {
      timeoutMs,
      extraHeaders: { 'User-Agent': UA },
      rateLimitRetries: 1,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export const NARRATIVE_GECKO_IDS: Record<string, string[]> = {
  rwa: ['real-world-assets-rwa'],
  ia: ['artificial-intelligence'],
  defi: ['decentralized-finance-defi'],
  emprestimos: ['lending-borrowing', 'decentralized-lending'],
  layer1: ['layer-1'],
  layer2: ['layer-2'],
  memecoins: ['meme-token'],
  gaming: ['gaming'],
  restaking: ['restaking', 'liquid-staking-derivatives'],
  depin: ['depin'],
}

export async function fetchCoinGeckoCategories(): Promise<RawCgCategory[]> {
  const rows = await cgJson<
    Array<{
      id?: string
      name?: string
      market_cap?: number
      market_cap_change_24h?: number
      volume_24h?: number
    }>
  >('/coins/categories')
  if (!Array.isArray(rows)) return []
  return rows
    .filter((r) => r.id && r.name)
    .map((r) => ({
      id: r.id!,
      name: r.name!,
      marketCap: typeof r.market_cap === 'number' ? r.market_cap : null,
      marketCapChange24h: typeof r.market_cap_change_24h === 'number' ? r.market_cap_change_24h : null,
      volume24h: typeof r.volume_24h === 'number' ? r.volume_24h : null,
    }))
}

function mapMarkets(rows: RawMarketCoin[] | null): RawMarketCoin[] {
  if (!Array.isArray(rows)) return []
  return rows.map((r) => ({
    ...r,
    image: r.image ?? COINGECKO_LOGO_BY_ID[r.id] ?? null,
  }))
}

/** Só as 3 categorias mais quentes — evita 429 no CoinGecko. */
export async function fetchCategoryCoins(
  geckoCategoryIds: string[],
  perPage = 36,
): Promise<Record<string, RawMarketCoin[]>> {
  const out: Record<string, RawMarketCoin[]> = {}
  const unique = [...new Set(geckoCategoryIds)].slice(0, 4)
  for (const id of unique) {
    const rows = await cgJson<RawMarketCoin[]>(
      `/coins/markets?vs_currency=usd&category=${encodeURIComponent(id)}&order=volume_desc&per_page=${perPage}&page=1&sparkline=false&price_change_percentage=24h,7d,30d,200d`,
      16_000,
    )
    out[id] = mapMarkets(rows)
  }
  return out
}
