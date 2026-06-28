import { NEON_SYNC_META_KEY, type NeonSyncDomain } from '@/lib/neon/constants'

export type NeonSyncMeta = Partial<Record<NeonSyncDomain, { updatedAt: string }>>

export function readSyncMeta(): NeonSyncMeta {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(NEON_SYNC_META_KEY) || '{}') as NeonSyncMeta
  } catch {
    return {}
  }
}

export function writeSyncMeta(domain: NeonSyncDomain, updatedAt: string): void {
  if (typeof window === 'undefined') return
  try {
    const meta = readSyncMeta()
    meta[domain] = { updatedAt }
    localStorage.setItem(NEON_SYNC_META_KEY, JSON.stringify(meta))
  } catch {
    /* ignore */
  }
}
