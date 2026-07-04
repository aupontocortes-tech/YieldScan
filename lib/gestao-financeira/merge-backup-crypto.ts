import type { GfCryptoHolding } from '@/lib/gestao-financeira/types'

function holdingKey(h: GfCryptoHolding): string {
  return `${h.walletId}:${h.coinId}`
}

/** Junta posições cripto local + nuvem, ficando sempre com a versão mais recente. */
export function mergeGfCryptoHoldings(
  local: GfCryptoHolding[],
  remote: GfCryptoHolding[],
): GfCryptoHolding[] {
  const byKey = new Map<string, GfCryptoHolding>()

  for (const h of remote) {
    byKey.set(holdingKey(h), h)
  }

  for (const h of local) {
    const k = holdingKey(h)
    const prev = byKey.get(k)
    if (!prev || new Date(h.updatedAt).getTime() >= new Date(prev.updatedAt).getTime()) {
      byKey.set(k, h)
    }
  }

  const localKeys = new Set(local.map(holdingKey))
  const localMaxUpdated = Math.max(0, ...local.map((h) => new Date(h.updatedAt).getTime()))

  for (const h of remote) {
    const k = holdingKey(h)
    if (localKeys.has(k)) continue
    if (local.length > 0 && localMaxUpdated > new Date(h.updatedAt).getTime()) {
      byKey.delete(k)
    }
  }

  return [...byKey.values()]
}
