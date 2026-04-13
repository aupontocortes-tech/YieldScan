/**
 * Orca (Whirlpools / legacy pools) — integração futura.
 * Manter lógica isolada daqui; importar apenas em módulos Solana (`@/lib/solana/...`).
 */
export type OrcaPoolRead = {
  readonly _brand: 'orca-not-implemented'
}

export function createOrcaReader(): null {
  return null
}
