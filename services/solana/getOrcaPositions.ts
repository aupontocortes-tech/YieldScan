/**
 * Orca Whirlpool — hoje as posições fungíveis + pares DexScreener entram via `fetchSolanaLiquidityPositions`.
 * Indexação CLMM completa (NFT + ticks) deve usar `@orca-so/whirlpools-sdk` no servidor; placeholder para evolução.
 */
export { fetchSolanaLiquidityPositions as getOrcaPositions } from '@/services/solana/getSolanaPositions'
