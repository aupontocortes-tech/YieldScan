/**
 * Coordenação de persistência Mercado (favoritos + moeda) entre localStorage, SQLite e Neon.
 * Evita que sync na nuvem sobrescreva edições recentes no telemóvel.
 */

import { flushYieldscanSqlitePersist } from '@/lib/client-db/sqlite-core'
import { writeSyncMeta } from '@/lib/neon/sync-meta'

const LOCAL_EDIT_KEY = 'yieldscan-mercado-local-edit-ms'
const MERCADO_DOMAIN = 'mercado' as const

export function markMercadoLocalEdit(): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  try {
    localStorage.setItem(LOCAL_EDIT_KEY, String(now))
  } catch {
    /* ignore */
  }
  writeSyncMeta(MERCADO_DOMAIN, new Date(now).toISOString())
}

/** Bloqueia pull Neon que apagaria favoritos/moeda guardados há instantes (ex.: telemóvel). */
export function isMercadoLocalEditRecent(windowMs = 45_000): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(LOCAL_EDIT_KEY)
    const t = raw ? Number(raw) : NaN
    return Number.isFinite(t) && Date.now() - t < windowMs
  } catch {
    return false
  }
}

export function dispatchMercadoStorageChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('yieldscan-mercado-storage-changed'))
}

export function afterMercadoLocalWrite(): void {
  markMercadoLocalEdit()
  void flushYieldscanSqlitePersist()
  dispatchMercadoStorageChanged()
}

export function pickNewerBySavedAt<T>(
  a: { value: T; savedAt: number } | null,
  b: { value: T; savedAt: number } | null,
): T | null {
  if (!a) return b?.value ?? null
  if (!b) return a.value
  return b.savedAt >= a.savedAt ? b.value : a.value
}
