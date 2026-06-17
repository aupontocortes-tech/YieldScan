import { GF_DEFAULT_CRYPTO_IDS } from '@/lib/gestao-financeira/categories-default'
import type { GfCryptoPriceMap } from '@/lib/gestao-financeira/calculations'

/** Preços via API interna /api/market (CoinGecko + Binance). */
export async function fetchGfCryptoPrices(ids: string[] = [...GF_DEFAULT_CRYPTO_IDS]): Promise<{
  prices: GfCryptoPriceMap
  brlPerUsd: number
}> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return { prices: {}, brlPerUsd: 5.1 }

  const q = new URLSearchParams({
    highlights: unique.join(','),
    mode: 'highlights',
  })
  const res = await fetch(`/api/market?${q.toString()}`)
  if (!res.ok) return { prices: {}, brlPerUsd: 5.1 }

  const json = (await res.json()) as {
    highlightIds: string[]
    highlightCoins: Array<{ id: string; price: number | null; quotes?: { brl?: { price: number } } } | null>
    fxRates?: { brlPerUsd: number } | null
  }

  const prices: GfCryptoPriceMap = {}
  json.highlightIds.forEach((id, i) => {
    const c = json.highlightCoins[i]
    if (!c?.price) return
    prices[id] = {
      usd: c.price,
      brl: c.quotes?.brl?.price ?? undefined,
    }
  })

  return { prices, brlPerUsd: json.fxRates?.brlPerUsd ?? 5.1 }
}
