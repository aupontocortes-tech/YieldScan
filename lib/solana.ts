import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'

/** RPC público mainnet quando `SOLANA_RPC_URL` não está definido (app continua funcional). */
const FALLBACK_MAINNET_HTTP = 'https://api.mainnet-beta.solana.com'

/**
 * URL do RPC Solana (servidor: rotas API, `getServerSideProps`, Server Actions).
 * Ordem: `SOLANA_RPC_URL` → `HELIUS_RPC_URL` (legado) → RPC público.
 *
 * No browser usa `NEXT_PUBLIC_SOLANA_RPC_URL` em `components/solana-wallet-providers.tsx`;
 * variáveis sem `NEXT_PUBLIC_` não chegam ao cliente no Next.js.
 */
export function getSolanaRpcUrl(): string {
  const primary = process.env.SOLANA_RPC_URL?.trim()
  if (primary) return primary
  const helius = process.env.HELIUS_RPC_URL?.trim()
  if (helius) return helius
  return FALLBACK_MAINNET_HTTP
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
  const conn = getSolanaConnection()
  const lamports = await conn.getBalance(pk, 'confirmed')
  return {
    lamports,
    sol: lamports / LAMPORTS_PER_SOL,
  }
}
