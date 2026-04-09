/**
 * CoinGecko no servidor (rotas /api/coingecko/*).
 * Chaves opcionais aumentam o limite e reduzem 429 no calculador.
 *
 * Pro: https://pro-api.coingecko.com + header x-cg-pro-api-key
 * Demo: https://api.coingecko.com + header x-cg-demo-api-key
 */
export function getCoingeckoRequestParts(): {
  base: string
  headers: Record<string, string>
} {
  const pro = process.env.COINGECKO_PRO_API_KEY?.trim()
  if (pro) {
    return {
      base: 'https://pro-api.coingecko.com/api/v3',
      headers: {
        Accept: 'application/json',
        'x-cg-pro-api-key': pro,
      },
    }
  }
  const demo = process.env.COINGECKO_DEMO_API_KEY?.trim()
  if (demo) {
    return {
      base: 'https://api.coingecko.com/api/v3',
      headers: {
        Accept: 'application/json',
        'x-cg-demo-api-key': demo,
      },
    }
  }
  return {
    base: 'https://api.coingecko.com/api/v3',
    headers: { Accept: 'application/json' },
  }
}
