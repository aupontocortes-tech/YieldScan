const KEY = 'yieldscan_unlocks_recent_v1'
const MAX = 8

export type UnlocksRecentCoin = {
  id: string
  symbol: string
  name: string
}

export function readUnlocksRecent(): UnlocksRecentCoin[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as UnlocksRecentCoin[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : []
  } catch {
    return []
  }
}

export function pushUnlocksRecent(coin: UnlocksRecentCoin): void {
  if (typeof window === 'undefined') return
  const prev = readUnlocksRecent().filter((c) => c.id !== coin.id)
  const next = [coin, ...prev].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
