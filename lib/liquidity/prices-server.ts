import { getCoingeckoRequestParts } from '@/lib/coingecko-server'

let ethUsdCache: { at: number; usd: number } | null = null
const ETH_USD_TTL_MS = 60_000

/** Preço spot de ETH em USD (CoinGecko, servidor). */
export async function fetchEthUsdSpot(): Promise<number> {
  const now = Date.now()
  if (ethUsdCache && now - ethUsdCache.at < ETH_USD_TTL_MS) {
    return ethUsdCache.usd
  }
  const { base, headers } = getCoingeckoRequestParts()
  const url = `${base}/simple/price?ids=ethereum&vs_currencies=usd`
  const res = await fetch(url, { headers, cache: 'no-store' })
  if (!res.ok) return ethUsdCache?.usd ?? 0
  const data = (await res.json()) as { ethereum?: { usd?: number } }
  const usd = Number(data.ethereum?.usd)
  if (Number.isFinite(usd) && usd > 0) {
    ethUsdCache = { at: now, usd }
    return usd
  }
  return ethUsdCache?.usd ?? 0
}

export function usdFromDerivedEth(derivedEth: string | undefined, ethUsd: number): number {
  const d = Number(derivedEth ?? '')
  if (!Number.isFinite(d) || d <= 0 || !Number.isFinite(ethUsd) || ethUsd <= 0) return 0
  return d * ethUsd
}
