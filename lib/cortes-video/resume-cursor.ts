import type { CortesVideoMeta } from '@/lib/cortes-video/types'

const STORAGE_KEY = 'yieldscan_cortes_resume_v1'

type ResumeMap = Record<string, { atSec: number; updatedAt: number }>

function fingerprint(meta: Pick<CortesVideoMeta, 'name' | 'sizeBytes' | 'durationSec'>): string {
  return `${meta.name}|${meta.sizeBytes}|${Math.round(meta.durationSec)}`
}

function readMap(): ResumeMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ResumeMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: ResumeMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota / private mode */
  }
}

export function loadResumeCursor(
  meta: Pick<CortesVideoMeta, 'name' | 'sizeBytes' | 'durationSec'>,
): number | null {
  if (typeof window === 'undefined') return null
  const row = readMap()[fingerprint(meta)]
  if (!row || typeof row.atSec !== 'number' || row.atSec <= 0) return null
  const max = Math.max(0, meta.durationSec - 0.5)
  if (row.atSec >= max) return null
  return Math.min(max, Math.max(0, row.atSec))
}

/** Guarda o ponto até onde o utilizador já trabalhou (fim do último trecho). */
export function saveResumeCursor(
  meta: Pick<CortesVideoMeta, 'name' | 'sizeBytes' | 'durationSec'>,
  atSec: number,
): void {
  if (typeof window === 'undefined') return
  const clamped = Math.max(0, Math.min(meta.durationSec, atSec))
  if (clamped < 1) return
  const map = readMap()
  map[fingerprint(meta)] = { atSec: clamped, updatedAt: Date.now() }
  // Limpa entradas antigas (>40)
  const entries = Object.entries(map).sort((a, b) => b[1].updatedAt - a[1].updatedAt)
  writeMap(Object.fromEntries(entries.slice(0, 40)))
}

export function clearResumeCursor(
  meta: Pick<CortesVideoMeta, 'name' | 'sizeBytes' | 'durationSec'>,
): void {
  if (typeof window === 'undefined') return
  const map = readMap()
  delete map[fingerprint(meta)]
  writeMap(map)
}
