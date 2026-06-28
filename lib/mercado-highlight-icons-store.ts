import { isYieldscanSqliteOpen, kvGetJson, kvSetJson } from '@/lib/client-db/sqlite-core'
import { scheduleNeonPush } from '@/lib/neon/sync-schedule'

const STORAGE_KEY = 'yieldscan-mercado-highlight-icons'
const KV_KEY = 'mercado_highlight_icons_v1'

export type HighlightIconMap = Record<string, string>

function sanitizeIconMap(raw: Record<string, unknown>): HighlightIconMap {
  const out: HighlightIconMap = {}
  for (const [k, v] of Object.entries(raw)) {
    const id = k.trim().toLowerCase()
    const url = typeof v === 'string' ? v.trim() : ''
    if (!id || !url.startsWith('https://')) continue
    out[id] = url
  }
  return out
}

export function readHighlightIconMap(): HighlightIconMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return sanitizeIconMap(parsed as Record<string, unknown>)
      }
    }
  } catch {
    /* ignore */
  }
  if (isYieldscanSqliteOpen()) {
    const parsed = kvGetJson<unknown>(KV_KEY)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return sanitizeIconMap(parsed as Record<string, unknown>)
    }
  }
  return {}
}

export function writeHighlightIconMap(map: HighlightIconMap, opts?: { skipNeon?: boolean }): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    } catch {
      /* ignore */
    }
  }
  kvSetJson(KV_KEY, map)
  if (!opts?.skipNeon) scheduleNeonPush('mercado')
}
