import {
  DEFAULT_TENDENCIAS_PREFS,
  type TendenciasPrefs,
  type MomentumPeriod,
  type AnalysisTone,
} from '@/lib/tendencias/types'

const STORAGE_KEY = 'yieldscan:tendencias-prefs'

export function readTendenciasPrefs(): TendenciasPrefs {
  if (typeof window === 'undefined') return DEFAULT_TENDENCIAS_PREFS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_TENDENCIAS_PREFS
    const p = JSON.parse(raw) as Partial<TendenciasPrefs>
    return {
      momentumPeriod: isPeriod(p.momentumPeriod) ? p.momentumPeriod : DEFAULT_TENDENCIAS_PREFS.momentumPeriod,
      analysisTone: isTone(p.analysisTone) ? p.analysisTone : DEFAULT_TENDENCIAS_PREFS.analysisTone,
    }
  } catch {
    return DEFAULT_TENDENCIAS_PREFS
  }
}

export function writeTendenciasPrefs(prefs: TendenciasPrefs) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

function isPeriod(v: unknown): v is MomentumPeriod {
  return v === '7d' || v === '30d' || v === '90d'
}

function isTone(v: unknown): v is AnalysisTone {
  return v === 'conservador' || v === 'neutro' || v === 'agressivo'
}
