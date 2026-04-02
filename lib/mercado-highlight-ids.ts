/**
 * IDs CoinGecko (slug) para os 4 cartões grandes do mercado.
 * Preferências guardadas só no browser (localStorage).
 */

export const DEFAULT_MARKET_HIGHLIGHT_IDS = [
  'bitcoin',
  'ethereum',
  'solana',
  'hyperliquid',
] as const

const STORAGE_KEY = 'yieldscan-mercado-highlight-ids'

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/

export function sanitizeHighlightIds(raw: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of raw) {
    const id = String(s).trim().toLowerCase()
    if (!id || !ID_RE.test(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= 4) break
  }
  return out.length > 0 ? out : [...DEFAULT_MARKET_HIGHLIGHT_IDS]
}

/** Query ?highlights=bitcoin,ethereum,... */
export function parseHighlightsQueryParam(param: string | null): string[] {
  if (!param?.trim()) return [...DEFAULT_MARKET_HIGHLIGHT_IDS]
  const parts = param
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
  return sanitizeHighlightIds(parts)
}

export function readStoredHighlightIds(): string[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return sanitizeHighlightIds(parsed.map(String))
  } catch {
    return null
  }
}

export function writeStoredHighlightIds(ids: string[]): void {
  const next = sanitizeHighlightIds(ids)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function clearStoredHighlightIds(): void {
  localStorage.removeItem(STORAGE_KEY)
}
