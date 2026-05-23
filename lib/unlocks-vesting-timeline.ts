import type { DefillamaEmissionEvent, DefillamaEmissionToken } from '@/services/api/defillama-emissions'
import { sumEventTokens } from '@/services/api/defillama-emissions'

const MS_DAY = 86_400_000
const BUCKET_MS = 30 * MS_DAY

export type VestingFutureUnlock = {
  at: number
  tokens: number
  usd: number | null
  category: string
}

export type VestingTimeline = {
  points: Array<Record<string, number | string>>
  categories: string[]
  futureUnlocks: VestingFutureUnlock[]
}

const CAT_COLORS: Record<string, string> = {
  Equipa: '#8b5cf6',
  Reservas: '#3b82f6',
  Ecosystem: '#22c55e',
  'Venda pública': '#f59e0b',
  Airdrop: '#06b6d4',
  Cliff: '#d4af37',
  Linear: '#22d3ee',
  Outros: '#64748b',
}

export function vestingCategoryColor(cat: string): string {
  return CAT_COLORS[cat] ?? '#64748b'
}

function toMs(ts: number): number {
  return ts > 1e12 ? ts : ts * 1000
}

export function normalizeVestingCategory(raw?: string | null): string {
  if (!raw) return 'Outros'
  const l = raw.toLowerCase()
  if (l.includes('insider') || l === 'team') return 'Equipa'
  if (l.includes('noncirc')) return 'Reservas'
  if (l.includes('farm') || l.includes('ecosystem')) return 'Ecosystem'
  if (l.includes('public')) return 'Venda pública'
  if (l.includes('airdrop')) return 'Airdrop'
  if (l.includes('cliff')) return 'Cliff'
  if (l.includes('linear')) return 'Linear'
  return raw.length > 12 ? `${raw.slice(0, 10)}…` : raw
}

function bucketLabel(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
}

export function buildVestingTimeline(
  row: DefillamaEmissionToken,
  priceUsd: number | null,
  nowMs = Date.now()
): VestingTimeline {
  const events = [...(row.events ?? [])]
    .filter((e) => e.timestamp && sumEventTokens(e) > 0)
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))

  const futureUnlocks: VestingFutureUnlock[] = []
  for (const ev of events) {
    const tsMs = toMs(ev.timestamp!)
    if (tsMs < nowMs) continue
    const tokens = sumEventTokens(ev)
    futureUnlocks.push({
      at: tsMs,
      tokens,
      usd: priceUsd && tokens > 0 ? tokens * priceUsd : null,
      category: normalizeVestingCategory(ev.category ?? ev.unlockType),
    })
  }
  futureUnlocks.sort((a, b) => a.at - b.at)

  if (!events.length) {
    const circ = row.circSupply ?? 0
    const max = row.maxSupply ?? circ
    const remaining = Math.max(0, max - circ)
    const points: Array<Record<string, number | string>> = [
      {
        timestamp: nowMs - BUCKET_MS,
        label: bucketLabel(nowMs - BUCKET_MS),
        Circulante: circ,
      },
    ]
    if (remaining > 0) {
      points.push({
        timestamp: nowMs + 365 * MS_DAY,
        label: bucketLabel(nowMs + 365 * MS_DAY),
        Circulante: circ,
        Pendente: remaining,
      })
    }
    return { points, categories: remaining > 0 ? ['Circulante', 'Pendente'] : ['Circulante'], futureUnlocks }
  }

  const firstTs = toMs(events[0]!.timestamp!)
  const lastTs = toMs(events[events.length - 1]!.timestamp!)
  const start = Math.min(firstTs, nowMs - 24 * 30 * MS_DAY)
  const end = Math.max(lastTs, nowMs + 36 * 30 * MS_DAY)

  const cumulative: Record<string, number> = {}
  const categoriesSet = new Set<string>()
  let eventIdx = 0
  const points: Array<Record<string, number | string>> = []

  for (let t = start; t <= end; t += BUCKET_MS) {
    while (eventIdx < events.length && toMs(events[eventIdx]!.timestamp!) <= t) {
      const ev = events[eventIdx]!
      const cat = normalizeVestingCategory(ev.category ?? ev.unlockType)
      const amt = sumEventTokens(ev)
      cumulative[cat] = (cumulative[cat] ?? 0) + amt
      categoriesSet.add(cat)
      eventIdx++
    }
    const point: Record<string, number | string> = {
      timestamp: t,
      label: bucketLabel(t),
    }
    for (const cat of categoriesSet) {
      point[cat] = cumulative[cat] ?? 0
    }
    points.push(point)
  }

  const categories = [...categoriesSet].sort((a, b) => {
    const va = cumulative[a] ?? 0
    const vb = cumulative[b] ?? 0
    return vb - va
  })

  return { points, categories: categories.slice(0, 6), futureUnlocks }
}
