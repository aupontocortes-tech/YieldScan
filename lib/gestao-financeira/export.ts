import type { GfBackupPayload } from '@/lib/gestao-financeira/types'

export function downloadGfJsonBackup(payload: GfBackupPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `yieldscan-gestao-financeira-${payload.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadGfCsv(
  transactions: GfBackupPayload['transactions'],
  categories: GfBackupPayload['categories'],
  range?: { start: Date; end: Date },
): void {
  const catMap = new Map(categories.map((c) => [c.id, c.name]))
  const rows = transactions
    .filter((t) => {
      if (!range) return true
      const d = new Date(t.occurredAt)
      return d >= range.start && d < range.end
    })
    .map((t) => {
    const cat = t.categoryId ? (catMap.get(t.categoryId) ?? '') : ''
    const desc = (t.description ?? '').replace(/"/g, '""')
    return `${t.occurredAt.slice(0, 10)},${t.type},${t.amount},"${cat}","${desc}",${t.cashBoxId}`
  })
  const header = 'data,tipo,valor,categoria,descricao,caixa\n'
  const suffix = range
    ? `${range.start.toISOString().slice(0, 10)}_${new Date(range.end.getTime() - 86_400_000).toISOString().slice(0, 10)}`
    : new Date().toISOString().slice(0, 10)
  const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `yieldscan-movimentacoes-${suffix}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export async function readGfBackupFile(file: File): Promise<GfBackupPayload> {
  const text = await file.text()
  const parsed = JSON.parse(text) as GfBackupPayload
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.transactions)) {
    throw new Error('Ficheiro de backup inválido')
  }
  return parsed
}

export function printGfReport(): void {
  if (typeof window !== 'undefined') window.print()
}
