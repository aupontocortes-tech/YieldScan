export type ImpactLevel = 'low' | 'medium' | 'high'

export type UnlockAlert = 'today' | 'tomorrow' | 'high-impact' | null

/** Impacto do evento sobre a supply circulante. */
export function classifyImpact(inflationPctCirc: number | null | undefined): ImpactLevel {
  if (inflationPctCirc == null || !Number.isFinite(inflationPctCirc)) return 'low'
  if (inflationPctCirc >= 2) return 'high'
  if (inflationPctCirc >= 0.5) return 'medium'
  return 'low'
}

export const IMPACT_LABEL: Record<ImpactLevel, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
}

export function impactDotClass(level: ImpactLevel): string {
  switch (level) {
    case 'high':
      return 'bg-destructive'
    case 'medium':
      return 'bg-orange-400'
    default:
      return 'bg-emerald-500/80'
  }
}

export function impactBadgeClass(level: ImpactLevel): string {
  switch (level) {
    case 'high':
      return 'border-destructive/40 bg-destructive/15 text-destructive'
    case 'medium':
      return 'border-orange-500/40 bg-orange-500/10 text-orange-300'
    default:
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  }
}

const MS_DAY = 86_400_000

export function getUnlockAlert(
  unlockAtMs: number | null,
  impact: ImpactLevel
): UnlockAlert {
  if (unlockAtMs == null) return impact === 'high' ? 'high-impact' : null
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startTomorrow = startToday + MS_DAY
  const startDayAfter = startTomorrow + MS_DAY
  if (unlockAtMs >= startToday && unlockAtMs < startTomorrow) return 'today'
  if (unlockAtMs >= startTomorrow && unlockAtMs < startDayAfter) return 'tomorrow'
  if (impact === 'high' && unlockAtMs - Date.now() <= 7 * MS_DAY) return 'high-impact'
  return null
}
