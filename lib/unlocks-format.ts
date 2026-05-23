import { formatCurrency, formatNumber, formatPercent } from '@/lib/api'

const MS_DAY = 86_400_000
const MS_HOUR = 3_600_000
const MS_MIN = 60_000

export function formatTokenAmount(value: number | null | undefined, compact = true): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (compact) {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`
  }
  return formatNumber(value, value < 1 ? 4 : 2)
}

export function formatUnlockDate(tsMs: number): string {
  return new Date(tsMs).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Data curta explícita: "24 mai 2026". */
export function formatUnlockDateExplicit(tsMs: number | null | undefined): string {
  if (tsMs == null) return 'Sem data'
  return new Date(tsMs).toLocaleDateString('pt-PT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Data relativa para traders: Hoje, Amanhã, N dias, ou "24 Mai". */
export function formatUnlockRelativeDate(tsMs: number | null | undefined): string {
  if (tsMs == null) return '—'
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startTomorrow = startToday + MS_DAY
  const startDayAfter = startTomorrow + MS_DAY

  if (tsMs >= startToday && tsMs < startTomorrow) return 'Hoje'
  if (tsMs >= startTomorrow && tsMs < startDayAfter) return 'Amanhã'

  const diffDays = Math.round((tsMs - startToday) / MS_DAY)
  if (diffDays > 1 && diffDays <= 14) return `${diffDays} dias`

  return new Date(tsMs).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

export function formatCountdown(tsMs: number | null | undefined, now = Date.now()): string | null {
  if (tsMs == null) return null
  const diff = tsMs - now
  if (diff <= 0) return 'Agora'
  const days = Math.floor(diff / MS_DAY)
  const hours = Math.floor((diff % MS_DAY) / MS_HOUR)
  const mins = Math.floor((diff % MS_HOUR) / MS_MIN)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function formatDualSupplyPct(
  circPct: number | null | undefined,
  maxPct: number | null | undefined
): string {
  const c =
    circPct != null && Number.isFinite(circPct) ? `+${circPct.toFixed(1)}% circ` : null
  const m =
    maxPct != null && Number.isFinite(maxPct) ? `${maxPct.toFixed(1)}% max` : null
  if (c && m) return `${c} · ${m}`
  return c ?? m ?? '—'
}

export function formatUnlockType(raw: string | null | undefined): string {
  if (!raw) return '—'
  const l = raw.toLowerCase()
  if (l.includes('cliff')) return 'Cliff'
  if (l.includes('linear')) return 'Linear'
  if (l === 'next') return 'Próximo'
  if (l.includes('pendente')) return 'Pendente'
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export { formatCurrency, formatPercent }
