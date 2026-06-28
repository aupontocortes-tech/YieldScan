import { scheduleNeonPush } from '@/lib/neon/sync-schedule'

export type SavedWalletRecord = {
  id: string
  chain: 'solana' | 'ethereum'
  evmChainId?: number
  address: string
  addedAt: number
  origin?: 'extension' | 'manual'
}

const STORAGE_KEY = 'ys_ml_wallets_v2'
const LEGACY_STORAGE_KEY = 'ys_ml_wallets_v1'

function parseWallets(raw: string | null): SavedWalletRecord[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (w): w is SavedWalletRecord =>
        Boolean(w && typeof w === 'object' && typeof (w as SavedWalletRecord).id === 'string'),
    )
  } catch {
    return []
  }
}

export function readSavedWallets(): SavedWalletRecord[] {
  if (typeof window === 'undefined') return []
  const v2 = parseWallets(localStorage.getItem(STORAGE_KEY))
  if (v2.length > 0) return v2
  return parseWallets(localStorage.getItem(LEGACY_STORAGE_KEY))
}

export function writeSavedWallets(wallets: SavedWalletRecord[], opts?: { skipNeon?: boolean }): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets))
  } catch {
    /* ignore */
  }
  if (!opts?.skipNeon) scheduleNeonPush('wallets')
}
