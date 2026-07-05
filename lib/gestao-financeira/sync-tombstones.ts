/** IDs apagados localmente — impedem a nuvem de repor registos no pull. */

const STORAGE_KEY = 'yieldscan_gf_sync_tombstones_v1'
const MAX_PER_KIND = 300

export type GfTombstoneKind = 'transactions' | 'debts' | 'todos' | 'cryptoHoldings'

type TombstoneStore = Partial<Record<GfTombstoneKind, string[]>>

function readStore(): TombstoneStore {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as TombstoneStore
  } catch {
    return {}
  }
}

function writeStore(store: TombstoneStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* quota */
  }
}

export function readGfTombstones(): Record<GfTombstoneKind, Set<string>> {
  const raw = readStore()
  return {
    transactions: new Set(raw.transactions ?? []),
    debts: new Set(raw.debts ?? []),
    todos: new Set(raw.todos ?? []),
    cryptoHoldings: new Set(raw.cryptoHoldings ?? []),
  }
}

export function recordGfTombstone(kind: GfTombstoneKind, id: string): void {
  const trimmed = id.trim()
  if (!trimmed || typeof window === 'undefined') return
  const store = readStore()
  const list = store[kind] ?? []
  if (!list.includes(trimmed)) list.push(trimmed)
  store[kind] = list.slice(-MAX_PER_KIND)
  writeStore(store)
}

export function isGfTombstoned(kind: GfTombstoneKind, id: string): boolean {
  return readGfTombstones()[kind].has(id)
}
