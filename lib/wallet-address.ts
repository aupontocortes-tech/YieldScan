import { isAddress } from 'ethers'
import { PublicKey } from '@solana/web3.js'

export type WalletChainTag = 'ethereum' | 'solana'

export function isValidEvmWalletAddress(raw: string): boolean {
  const s = raw.trim()
  return s.length > 0 && isAddress(s)
}

export function isValidSolanaWalletAddress(raw: string): boolean {
  const s = raw.trim()
  if (!s) return false
  try {
    const pk = new PublicKey(s)
    return pk.toBase58().length > 0
  } catch {
    return false
  }
}

export function isValidSavedWalletAddress(chain: WalletChainTag, address: string): boolean {
  return chain === 'ethereum'
    ? isValidEvmWalletAddress(address)
    : isValidSolanaWalletAddress(address)
}
