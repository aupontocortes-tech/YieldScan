import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'

/** RPC público mainnet quando `SOLANA_RPC_URL` não está definido (app continua funcional). */
const FALLBACK_MAINNET_HTTP = 'https://api.mainnet-beta.solana.com'

/**
 * URL do RPC Solana (servidor: rotas API, etc.).
 * Ordem: `SOLANA_RPC_URL` → `HELIUS_RPC_URL` → `NEXT_PUBLIC_SOLANA_RPC_URL` → RPC público.
 * Incluímos `NEXT_PUBLIC_*` para quem só define um URL na Vercel (evita servidor a usar nó público
 * diferente do browser e reduz pedidos “inválidos” por mistura de endpoints).
 */
export function getSolanaRpcUrl(): string {
  const c = getSolanaRpcUrlCandidates()
  return c[0] ?? FALLBACK_MAINNET_HTTP
}

/** Lista de RPCs a tentar no servidor (primário + fallbacks). */
export function getSolanaRpcUrlCandidates(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string | undefined) => {
    const u = raw?.trim()
    if (u && !seen.has(u)) {
      seen.add(u)
      out.push(u)
    }
  }
  push(process.env.SOLANA_RPC_URL)
  push(process.env.HELIUS_RPC_URL)
  push(process.env.NEXT_PUBLIC_SOLANA_RPC_URL)
  push(FALLBACK_MAINNET_HTTP)
  return out
}

let connectionSingleton: Connection | null = null

/**
 * Conexão Solana mainnet alinhada com `SOLANA_RPC_URL` (ou fallback seguro).
 * Commitment `confirmed` — padrão para leituras de saldo / contas.
 */
export function getSolanaConnection(): Connection {
  if (!connectionSingleton) {
    connectionSingleton = new Connection(getSolanaRpcUrl(), {
      commitment: 'confirmed',
    })
  }
  return connectionSingleton
}

/** Útil em testes ou após mudar env em runtime. */
export function resetSolanaConnectionCache(): void {
  connectionSingleton = null
}

export type SolanaNativeBalance = {
  lamports: number
  /** SOL com fração decimal (não arredondado para UI). */
  sol: number
}

/**
 * Saldo nativo (SOL) de uma carteira.
 * @throws se `walletAddress` não for um endereço Solana válido
 */
export async function getSolanaBalance(walletAddress: string): Promise<SolanaNativeBalance> {
  const pk = new PublicKey(walletAddress.trim())
  let last: unknown
  for (const url of getSolanaRpcUrlCandidates()) {
    const conn = new Connection(url, { commitment: 'confirmed' })
    try {
      const lamports = await conn.getBalance(pk, 'confirmed')
      return {
        lamports,
        sol: lamports / LAMPORTS_PER_SOL,
      }
    } catch (e) {
      last = e
    }
  }
  throw last
}
