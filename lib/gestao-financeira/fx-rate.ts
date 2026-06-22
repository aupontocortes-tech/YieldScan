/** Cotação USD/BRL via API interna (CoinGecko). */
export async function fetchBrlPerUsd(): Promise<number> {
  try {
    const res = await fetch('/api/market?mode=highlights&highlights=bitcoin')
    if (!res.ok) return 5.1
    const json = (await res.json()) as { fxRates?: { brlPerUsd?: number } | null }
    const fx = json.fxRates?.brlPerUsd
    return typeof fx === 'number' && fx > 0 ? fx : 5.1
  } catch {
    return 5.1
  }
}
