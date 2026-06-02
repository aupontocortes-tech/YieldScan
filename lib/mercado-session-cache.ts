import type { MarketApiPayload } from '@/lib/coingecko-market'
import { sanitizeMercadoErro } from '@/lib/mercado-erro'

const STORAGE_KEY = 'yieldscan:mercado-snapshot-v1'
const MAX_AGE_MS = 20 * 60_000

type Entry = { key: string; savedAt: number; payload: MarketApiPayload }

function readAll(): Entry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as Entry[]) : []
  } catch {
    return []
  }
}

function writeAll(entries: Entry[]) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 4)))
  } catch {
    /* quota */
  }
}

/** Último snapshot de mercado para mostrar preços logo ao abrir a app. */
export function readMercadoSessionCache(queryKey: string): MarketApiPayload | undefined {
  const now = Date.now()
  const hit = readAll().find((e) => e.key === queryKey && now - e.savedAt < MAX_AGE_MS)
  const payload = hit?.payload
  if (!payload) return undefined
  const erro = sanitizeMercadoErro(payload.erro)
  if (erro === payload.erro) return payload
  return { ...payload, erro }
}

export function writeMercadoSessionCache(queryKey: string, payload: MarketApiPayload): void {
  if (!payload.highlightCoins.some((c) => c?.price != null) && payload.top10.length === 0) return
  const cleaned: MarketApiPayload = {
    ...payload,
    erro: sanitizeMercadoErro(payload.erro),
  }
  const next: Entry = { key: queryKey, savedAt: Date.now(), payload: cleaned }
  const rest = readAll().filter((e) => e.key !== queryKey)
  writeAll([next, ...rest])
}
