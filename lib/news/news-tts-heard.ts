/**
 * Notícias TTS: estado "já ouvi até ao fim" (SQLite via kv YieldScan).
 */

import { kvGetJson, kvSetJson } from '@/lib/client-db/sqlite-core'

const KV_KEY = 'news_tts_heard_v1' as const
const HEARD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type NewsTtsHeardMap = Record<string, number>

function pruneMap(map: NewsTtsHeardMap, now: number): NewsTtsHeardMap {
  const out: NewsTtsHeardMap = {}
  for (const [k, t] of Object.entries(map)) {
    if (typeof t === 'number' && now - t <= HEARD_MAX_AGE_MS) out[k] = t
  }
  return out
}

export function getNewsTtsHeardMap(): NewsTtsHeardMap {
  return kvGetJson<NewsTtsHeardMap>(KV_KEY) ?? {}
}

export function isNewsTtsHeard(speechId: string): boolean {
  return Boolean(getNewsTtsHeardMap()[speechId])
}

/** Remove entradas com mais de 7 dias; só grava se houver mudança. */
export function pruneNewsTtsHeardIfStale(): void {
  const now = Date.now()
  const cur = getNewsTtsHeardMap()
  const next = pruneMap(cur, now)
  if (Object.keys(next).length === Object.keys(cur).length) return
  kvSetJson(KV_KEY, next)
}

export function markNewsTtsHeard(speechId: string): void {
  const now = Date.now()
  let cur = pruneMap(getNewsTtsHeardMap(), now)
  cur[speechId] = now
  kvSetJson(KV_KEY, cur)
}
