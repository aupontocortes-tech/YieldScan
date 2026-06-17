import type { MarketApiPayload } from '@/lib/coingecko-market'
import { sanitizeMercadoErro } from '@/lib/mercado-erro'

const SESSION_KEY = 'yieldscan:mercado-snapshot-v1'
const PERSIST_KEY = 'yieldscan:mercado-persist-v1'
const SESSION_MAX_AGE_MS = 20 * 60_000
/** No telemóvel o snapshot sobrevive ao fechar o separador/PWA. */
const PERSIST_MAX_AGE_MS = 4 * 60 * 60_000

type Entry = { key: string; savedAt: number; payload: MarketApiPayload }

function readBucket(storageKey: string): Entry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as Entry[]) : []
  } catch {
    return []
  }
}

function writeBucket(storageKey: string, entries: Entry[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(entries.slice(0, 6)))
  } catch {
    /* quota */
  }
}

function readSessionBucket(): Entry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as Entry[]) : []
  } catch {
    return []
  }
}

function writeSessionBucket(entries: Entry[]) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(entries.slice(0, 4)))
  } catch {
    /* quota */
  }
}

function findFresh(entries: Entry[], queryKey: string, maxAgeMs: number): Entry | undefined {
  const now = Date.now()
  return entries.find((e) => e.key === queryKey && now - e.savedAt < maxAgeMs)
}

function cleanPayload(payload: MarketApiPayload): MarketApiPayload {
  const erro = sanitizeMercadoErro(payload.erro)
  if (erro === payload.erro) return payload
  return { ...payload, erro }
}

function hasUsefulPayload(payload: MarketApiPayload): boolean {
  return payload.highlightCoins.some((c) => c?.price != null) || payload.top10.length > 0
}

/** Último snapshot de mercado — sessão (20 min) ou persistência local (4 h no telemóvel). */
export function readMercadoSessionCache(queryKey: string): MarketApiPayload | undefined {
  const sessionHit = findFresh(readSessionBucket(), queryKey, SESSION_MAX_AGE_MS)
  if (sessionHit) return cleanPayload(sessionHit.payload)

  const persistHit = findFresh(readBucket(PERSIST_KEY), queryKey, PERSIST_MAX_AGE_MS)
  if (persistHit) return cleanPayload(persistHit.payload)

  return undefined
}

export function readMercadoCacheUpdatedAt(queryKey: string): number | undefined {
  const now = Date.now()
  const sessionHit = findFresh(readSessionBucket(), queryKey, SESSION_MAX_AGE_MS)
  if (sessionHit) return sessionHit.savedAt

  const persistHit = findFresh(readBucket(PERSIST_KEY), queryKey, PERSIST_MAX_AGE_MS)
  if (persistHit) return persistHit.savedAt

  void now
  return undefined
}

export function writeMercadoSessionCache(queryKey: string, payload: MarketApiPayload): void {
  if (!hasUsefulPayload(payload)) return

  const cleaned = cleanPayload(payload)
  const next: Entry = { key: queryKey, savedAt: Date.now(), payload: cleaned }

  const sessionRest = readSessionBucket().filter((e) => e.key !== queryKey)
  writeSessionBucket([next, ...sessionRest])

  const persistRest = readBucket(PERSIST_KEY).filter((e) => e.key !== queryKey)
  writeBucket(PERSIST_KEY, [next, ...persistRest])
}
