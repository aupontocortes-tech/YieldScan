/**
 * Notícias já visualizadas (SQLite kv YieldScan).
 */

import { kvGetJson, kvSetJson } from '@/lib/client-db/sqlite-core'
import { scheduleNeonPush } from '@/lib/neon/sync-schedule'

const KV_KEY = 'news_seen_v1' as const
const SEEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type NewsSeenMap = Record<string, number>

function pruneMap(map: NewsSeenMap, now: number): NewsSeenMap {
  const out: NewsSeenMap = {}
  for (const [k, t] of Object.entries(map)) {
    if (typeof t === 'number' && now - t <= SEEN_MAX_AGE_MS) out[k] = t
  }
  return out
}

export function getNewsSeenMap(): NewsSeenMap {
  return kvGetJson<NewsSeenMap>(KV_KEY) ?? {}
}

export function isNewsSeen(speechId: string): boolean {
  return Boolean(getNewsSeenMap()[speechId])
}

/** Remove entradas com mais de 7 dias; só grava se houver mudança. */
export function pruneNewsSeenIfStale(): void {
  const now = Date.now()
  const cur = getNewsSeenMap()
  const next = pruneMap(cur, now)
  if (Object.keys(next).length === Object.keys(cur).length) return
  kvSetJson(KV_KEY, next)
}

export function markNewsSeen(speechId: string): void {
  const now = Date.now()
  let cur = pruneMap(getNewsSeenMap(), now)
  if (typeof cur[speechId] === 'number') return
  cur[speechId] = now
  kvSetJson(KV_KEY, cur)
  scheduleNeonPush('news_state')
}
