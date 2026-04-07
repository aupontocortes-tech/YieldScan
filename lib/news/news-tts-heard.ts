/**
 * Notícias TTS: estado "já ouvi até ao fim" (SQLite via kv YieldScan).
 */

import { kvGetJson, kvSetJson } from '@/lib/client-db/sqlite-core'

const KV_KEY = 'news_tts_heard_v1' as const

export type NewsTtsHeardMap = Record<string, number>

export function getNewsTtsHeardMap(): NewsTtsHeardMap {
  return kvGetJson<NewsTtsHeardMap>(KV_KEY) ?? {}
}

export function isNewsTtsHeard(speechId: string): boolean {
  return Boolean(getNewsTtsHeardMap()[speechId])
}

export function markNewsTtsHeard(speechId: string): void {
  const cur = getNewsTtsHeardMap()
  cur[speechId] = Date.now()
  kvSetJson(KV_KEY, cur)
}
