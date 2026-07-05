import type { GfBackupPayload } from '@/lib/gestao-financeira/types'
import { mergeGfCryptoHoldings } from '@/lib/gestao-financeira/merge-backup-crypto'
import { readGfTombstones } from '@/lib/gestao-financeira/sync-tombstones'

function mergeRows<T extends { id: string }>(
  localRows: T[],
  remoteRows: T[],
  deleted: Set<string>,
  updatedAt: (row: T) => string,
): T[] {
  const byId = new Map<string, T>()
  for (const row of remoteRows) {
    if (deleted.has(row.id)) continue
    byId.set(row.id, row)
  }
  for (const row of localRows) {
    if (deleted.has(row.id)) continue
    const prev = byId.get(row.id)
    if (!prev) {
      byId.set(row.id, row)
      continue
    }
    if (new Date(updatedAt(row)).getTime() >= new Date(updatedAt(prev)).getTime()) {
      byId.set(row.id, row)
    }
  }
  return [...byId.values()]
}

/** Junta local + nuvem respeitando exclusões locais (tombstones). */
export function mergeGfBackups(local: GfBackupPayload, remote: GfBackupPayload): GfBackupPayload {
  const tomb = readGfTombstones()

  const cryptoHoldings = mergeGfCryptoHoldings(
    local.cryptoHoldings ?? [],
    remote.cryptoHoldings ?? [],
  ).filter((h) => !tomb.cryptoHoldings.has(h.id))

  return {
    version: remote.version ?? local.version,
    exportedAt: new Date().toISOString(),
    categories: remote.categories?.length ? remote.categories : local.categories,
    cashBoxes: mergeRows(local.cashBoxes, remote.cashBoxes, new Set(), (b) => b.updatedAt),
    transactions: mergeRows(
      local.transactions,
      remote.transactions ?? [],
      tomb.transactions,
      (t) => t.createdAt,
    ),
    debts: mergeRows(local.debts, remote.debts ?? [], tomb.debts, (d) => d.updatedAt),
    todos: mergeRows(local.todos ?? [], remote.todos ?? [], tomb.todos, (t) => t.updatedAt),
    investments: mergeRows(local.investments, remote.investments ?? [], new Set(), (i) => i.updatedAt),
    cryptoWallets: mergeRows(
      local.cryptoWallets ?? [],
      remote.cryptoWallets ?? [],
      new Set(),
      (w) => w.createdAt,
    ),
    cryptoHoldings,
    patrimonySnapshots: mergeRows(
      local.patrimonySnapshots ?? [],
      remote.patrimonySnapshots ?? [],
      new Set(),
      (s) => s.recordedAt,
    ),
  }
}
