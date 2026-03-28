/**
 * DefiLlama às vezes repete a mesma rede com strings diferentes (`APTOS` vs `Aptos`,
 * `Op_bnb` vs `Opbnb`). Normalizamos para um rótulo estável para filtro e exibição.
 */
function aliasKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_]+/g, '')
}

/** Chave = aliasKey(variante) → rótulo canônico (como queremos guardar em `pool.chain`). */
const ALIAS_TO_CANONICAL: Record<string, string> = {
  aptos: 'Aptos',
  icp: 'ICP',
  opbnb: 'opBNB',
  cronoszkevm: 'Cronos zkEVM',
  ton: 'TON',
}

export function canonicalLlamaChain(raw: string | null | undefined): string {
  if (raw == null) return ''
  const t = raw.trim()
  if (!t) return ''
  const key = aliasKey(t)
  return ALIAS_TO_CANONICAL[key] ?? t
}

export function normalizePoolChains<T extends { chain: string }>(pools: T[]): T[] {
  return pools.map((p) => {
    const c = canonicalLlamaChain(p.chain)
    return { ...p, chain: c || p.chain }
  })
}
