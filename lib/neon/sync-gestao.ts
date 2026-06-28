import { ensureGfDb, exportGfBackup, importGfBackup, hasGfUserData } from '@/lib/gestao-financeira/db'
import type { GfBackupPayload } from '@/lib/gestao-financeira/types'
import { GF_DATA_CHANGED_EVENT } from '@/lib/gestao-financeira/save-parsed-voice'
import { isRemoteNewer, pullNeonSync, pushNeonSync } from '@/lib/neon/sync-client'
import { writeSyncMeta } from '@/lib/neon/sync-meta'

let pushTimer: ReturnType<typeof setTimeout> | null = null

function isGfPayload(v: unknown): v is GfBackupPayload {
  if (!v || typeof v !== 'object') return false
  const p = v as GfBackupPayload
  return Array.isArray(p.categories) && Array.isArray(p.transactions)
}

/** Puxa Gestão Financeira + afazeres do Neon se a nuvem for mais recente ou local vazio. */
export async function pullGfFromNeon(): Promise<boolean> {
  await ensureGfDb()
  const remote = await pullNeonSync('gestao_financeira')
  if (!remote.configured || !remote.ok || !remote.payload) return false

  if (!isGfPayload(remote.payload)) return false
  const shouldImport = isRemoteNewer('gestao_financeira', remote.updatedAt) || !hasGfUserData()
  if (!shouldImport) return false

  importGfBackup(remote.payload)
  if (remote.updatedAt) writeSyncMeta('gestao_financeira', remote.updatedAt)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GF_DATA_CHANGED_EVENT))
  }
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
  const payload = exportGfBackup()
  await pushNeonSync('gestao_financeira', payload)
}

export function initGfNeonSync(): () => void {
  if (typeof window === 'undefined') return () => {}

  void pullGfFromNeon()

  const onChange = () => schedulePushGfToNeon()
  window.addEventListener(GF_DATA_CHANGED_EVENT, onChange)

  return () => {
    window.removeEventListener(GF_DATA_CHANGED_EVENT, onChange)
    if (pushTimer) clearTimeout(pushTimer)
  }
}
