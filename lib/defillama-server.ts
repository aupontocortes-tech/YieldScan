/**
 * DefiLlama Pro (emissions / unlocks).
 * @see https://defillama.com/docs/api — Token Unlocks: GET /api/emissions
 *
 * Autenticação: https://pro-api.llama.fi/{DEFILLAMA_PRO_API_KEY}/api/emissions
 */
export function getDefillamaProApiKey(): string | null {
  const key = process.env.DEFILLAMA_PRO_API_KEY?.trim()
  return key || null
}

export function getDefillamaProUrl(path: string): string | null {
  const key = getDefillamaProApiKey()
  if (!key) return null
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `https://pro-api.llama.fi/${encodeURIComponent(key)}${normalized}`
}
