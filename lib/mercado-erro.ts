/** Mensagens antigas / ruído que não devem aparecer na UI. */
const NOISE_PATTERNS = [
  /lista top 10 indispon[ií]vel/i,
  /taxas brl\/eur indispon[ií]veis/i,
  /cota[cç][oõ]es aproximadas/i,
  /trending indispon[ií]vel/i,
  /alguns preços v[eê]m de cache recente/i,
  /coinGecko\s*401/i,
  /coinGecko\s*403/i,
]

/**
 * Remove avisos obsoletos (ex. cache de sessão) e frases vazias.
 */
export function sanitizeMercadoErro(erro: string | null | undefined): string | null {
  if (!erro?.trim()) return null
  const parts = erro
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const kept = parts.filter((p) => !NOISE_PATTERNS.some((re) => re.test(p)))
  const joined = kept.join(' ').trim()
  return joined.length > 0 ? joined : null
}
