import {
  createGfCategory,
  ensureGfDb,
  findGfCategoryByName,
  getDefaultCashBox,
  insertGfTransaction,
  listGfCashBoxes,
} from '@/lib/gestao-financeira/db'
import type { GfParsedVoiceEntry } from '@/lib/gestao-financeira/types'
import { resolveCashBoxId } from '@/lib/gestao-financeira/voice-parser'

export const GF_DATA_CHANGED_EVENT = 'yieldscan:gf-data-changed'

/** Grava movimentação interpretada da voz (SQLite local). */
export async function saveGfParsedVoiceEntry(parsed: GfParsedVoiceEntry): Promise<boolean> {
  await ensureGfDb()

  const boxes = listGfCashBoxes()
  const cashBoxId = resolveCashBoxId(boxes, parsed.cashBoxName ?? null) ?? getDefaultCashBox()?.id
  if (!cashBoxId) return false

  let categoryId: string | null = null
  if (parsed.categoryName) {
    categoryId =
      findGfCategoryByName(parsed.categoryName)?.id ??
      createGfCategory(parsed.categoryName, parsed.type === 'income' ? 'income' : 'expense').id
  }

  const toCashBoxId =
    parsed.type === 'transfer' ? resolveCashBoxId(boxes, parsed.toCashBoxName ?? null) : null

  if (parsed.type === 'transfer' && (!toCashBoxId || toCashBoxId === cashBoxId)) return false

  insertGfTransaction({
    type: parsed.type,
    amount: parsed.amount,
    categoryId,
    cashBoxId,
    toCashBoxId: parsed.type === 'transfer' ? toCashBoxId : null,
    description: parsed.description,
    occurredAt: parsed.occurredAt,
  })

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GF_DATA_CHANGED_EVENT))
  }

  return true
}
