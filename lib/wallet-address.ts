import { isAddress } from 'ethers'
import { PublicKey } from '@solana/web3.js'

export type WalletChainTag = 'ethereum' | 'solana'

export function isValidEvmWalletAddress(raw: string): boolean {
  const s = raw.trim()
  return s.length > 0 && isAddress(s)
}

export function isValidSolanaWalletAddress(raw: string): boolean {
  return normalizeSolanaAddressInput(raw) != null
}

/**
 * Aceita texto colado com espaços/vírgulas; devolve base58 canónico ou null.
 */
export function normalizeSolanaAddressInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const chunks = trimmed.split(/[\s,;]+/).filter(Boolean)
  const candidates = [...new Set([trimmed, ...chunks])]
  for (const c of candidates) {
    try {
      return new PublicKey(c).toBase58()
    } catch {
      continue
    }
  }
  return null
}

export function isValidSavedWalletAddress(chain: WalletChainTag, address: string): boolean {
  return chain === 'ethereum'
    ? isValidEvmWalletAddress(address)
    : isValidSolanaWalletAddress(address)
}
