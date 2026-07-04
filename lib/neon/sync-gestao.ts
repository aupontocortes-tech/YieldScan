import { ensureGfDb, deleteGfCryptoHolding, exportGfBackup, importGfBackup, hasGfUserData, listGfCryptoHoldings } from '@/lib/gestao-financeira/db'
import type { GfBackupPayload } from '@/lib/gestao-financeira/types'
import { mergeGfCryptoHoldings } from '@/lib/gestao-financeira/merge-backup-crypto'
import { GF_DATA_CHANGED_EVENT } from '@/lib/gestao-financeira/save-parsed-voice'
import { isRemoteNewer, pullNeonSync, pushNeonSync } from '@/lib/neon/sync-client'
import { writeSyncMeta } from '@/lib/neon/sync-meta'

let pushTimer: ReturnType<typeof setTimeout> | null = null

function isGfPayload(v: unknown): v is GfBackupPayload {
  if (!v || typeof v !== 'object') return false
  const p = v as GfBackupPayload
  return Array.isArray(p.categories) && Array.isArray(p.transactions)
}

/** Importa nuvem se tiver dados novos (mesmo ID) — merge, não apaga local. */
function shouldImportGfRemote(remote: GfBackupPayload, remoteUpdatedAt: string | null): boolean {
  if (!hasGfUserData()) return true
  if (isRemoteNewer('gestao_financeira', remoteUpdatedAt)) return true

  const local = exportGfBackup()
  const localTxIds = new Set(local.transactions.map((t) => t.id))
  if ((remote.transactions ?? []).some((t) => !localTxIds.has(t.id))) return true

  const localTodoIds = new Set((local.todos ?? []).map((t) => t.id))
  if ((remote.todos ?? []).some((t) => !localTodoIds.has(t.id))) return true

  const localCryptoKeys = new Set((local.cryptoHoldings ?? []).map((h) => `${h.walletId}:${h.coinId}`))
  if ((remote.cryptoHoldings ?? []).some((h) => !localCryptoKeys.has(`${h.walletId}:${h.coinId}`))) return true

  for (const lh of local.cryptoHoldings ?? []) {
    const rh = (remote.cryptoHoldings ?? []).find((h) => h.walletId === lh.walletId && h.coinId === lh.coinId)
    if (!rh) continue
    if (lh.quantity !== rh.quantity || lh.avgPriceUsd !== rh.avgPriceUsd) {
      if (new Date(lh.updatedAt).getTime() > new Date(rh.updatedAt).getTime()) return false
      if (new Date(rh.updatedAt).getTime() > new Date(lh.updatedAt).getTime()) return true
    }
  }

  if (remote.exportedAt && local.exportedAt) {
    return new Date(remote.exportedAt).getTime() > new Date(local.exportedAt).getTime()
  }

  return false
}

function notifyGfDataChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GF_DATA_CHANGED_EVENT))
  }
}

/** Puxa Gestão Financeira + afazeres do Neon (merge por id). */
export async function pullGfFromNeon(): Promise<boolean> {
  await ensureGfDb()
  const remote = await pullNeonSync('gestao_financeira')
  if (!remote.configured || !remote.ok || !remote.payload) return false

  if (!isGfPayload(remote.payload)) return false
  if (!shouldImportGfRemote(remote.payload, remote.updatedAt)) return false

  const local = exportGfBackup()
  const mergedHoldings = mergeGfCryptoHoldings(
    local.cryptoHoldings ?? [],
    remote.payload.cryptoHoldings ?? [],
  )
  importGfBackup({ ...remote.payload, cryptoHoldings: mergedHoldings })

  const mergedKeys = new Set(mergedHoldings.map((h) => `${h.walletId}:${h.coinId}`))
  for (const h of listGfCryptoHoldings()) {
    if (!mergedKeys.has(`${h.walletId}:${h.coinId}`)) deleteGfCryptoHolding(h.id)
  }

  if (remote.updatedAt) writeSyncMeta('gestao_financeira', remote.updatedAt)
  notifyGfDataChanged()
  return true
}

export function schedulePushGfToNeon(): void {
  if (typeof window === 'undefined') return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void pushGfToNeonNow()
  }, 2500)
}

export async function pushGfToNeonNow(): Promise<void> {
  await ensureGfDb()
  await pullGfFromNeon()
  const payload = exportGfBackup()
  await pushNeonSync('gestao_financeira', payload)
}

export function initGfNeonSync(): () => void {
  if (typeof window === 'undefined') return () => {}

  void pullGfFromNeon()

  const onVisible = () => {
    if (document.visibilityState === 'visible') void pullGfFromNeon()
  }
  document.addEventListener('visibilitychange', onVisible)

  const onChange = () => schedulePushGfToNeon()
  window.addEventListener(GF_DATA_CHANGED_EVENT, onChange)

  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener(GF_DATA_CHANGED_EVENT, onChange)
    if (pushTimer) clearTimeout(pushTimer)
  }
}
