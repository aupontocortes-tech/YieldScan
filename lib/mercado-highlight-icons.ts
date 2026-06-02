/**
 * Ícones guardados ao adicionar favoritos (thumb da pesquisa CoinGecko).
 */

import { isYieldscanSqliteOpen, kvGetJson, kvSetJson } from '@/lib/client-db/sqlite-core'

const STORAGE_KEY = 'yieldscan-mercado-highlight-icons'
const KV_KEY = 'mercado_highlight_icons_v1'

export type HighlightIconMap = Record<string, string>

function readMap(): HighlightIconMap {
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

function writeMap(map: HighlightIconMap): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    } catch {
      /* ignore */
    }
  }
  kvSetJson(KV_KEY, map)
}

export function readHighlightIconUrl(coinId: string): string | null {
  const id = coinId.trim().toLowerCase()
  if (!id) return null
  return readMap()[id] ?? null
}

export function writeHighlightIconUrl(coinId: string, iconUrl: string | null | undefined): void {
  const id = coinId.trim().toLowerCase()
  const url = iconUrl?.trim()
  if (!id || !url || !url.startsWith('https://')) return
  const map = readMap()
  if (map[id] === url) return
  writeMap({ ...map, [id]: url })
}

export function mergeHighlightIconMaps(...maps: HighlightIconMap[]): HighlightIconMap {
  return Object.assign({}, ...maps)
}
