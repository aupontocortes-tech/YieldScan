/**
 * Protege a carteira no telemóvel: marca edições locais e evita pull Neon a apagar dados recentes.
 */

import { writeSyncMeta } from '@/lib/neon/sync-meta'

const LOCAL_EDIT_KEY = 'yieldscan-portfolio-local-edit-ms'
const PORTFOLIO_DOMAIN = 'portfolio' as const

export function markPortfolioLocalEdit(): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  try {
    localStorage.setItem(LOCAL_EDIT_KEY, String(now))
  } catch {
    /* ignore */
  }
  writeSyncMeta(PORTFOLIO_DOMAIN, new Date(now).toISOString())
}

/** Bloqueia pull Neon que apagaria posições guardadas há instantes (ex.: telemóvel). */
export function isPortfolioLocalEditRecent(windowMs = 45_000): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(LOCAL_EDIT_KEY)
    const t = raw ? Number(raw) : NaN
    return Number.isFinite(t) && Date.now() - t < windowMs
  } catch {
    return false
  }
}
