import { defaultPortfolio, loadPortfolio, savePortfolio } from '@/lib/portfolio/storage'
import type { PortfolioData } from '@/lib/portfolio/types'
import { isRemoteNewer, pullNeonSync, pushNeonSync } from '@/lib/neon/sync-client'
import { writeSyncMeta } from '@/lib/neon/sync-meta'

export const NEON_PORTFOLIO_CHANGED = 'yieldscan-neon-portfolio-changed'

let pushTimer: ReturnType<typeof setTimeout> | null = null

function isPortfolioPayload(v: unknown): v is PortfolioData {
  if (!v || typeof v !== 'object') return false
  const p = v as PortfolioData
  return Array.isArray(p.holdings) && typeof p.version === 'number'
}

function hasPortfolioData(data: PortfolioData): boolean {
  return data.holdings.length > 0 || data.transactions.length > 0
}

export async function pullPortfolioFromNeon(): Promise<boolean> {
  const remote = await pullNeonSync('portfolio')
  if (!remote.configured || !remote.ok || !remote.payload) return false
  if (!isPortfolioPayload(remote.payload)) return false

  const local = loadPortfolio()
  const shouldImport = isRemoteNewer('portfolio', remote.updatedAt) || !hasPortfolioData(local)
  if (!shouldImport) return false

  savePortfolio(remote.payload)
  if (remote.updatedAt) writeSyncMeta('portfolio', remote.updatedAt)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NEON_PORTFOLIO_CHANGED))
  }
  return true
}

export function schedulePushPortfolioToNeon(data?: PortfolioData): void {
  if (typeof window === 'undefined') return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void pushPortfolioToNeonNow(data ?? loadPortfolio())
  }, 2500)
}

export async function pushPortfolioToNeonNow(data?: PortfolioData): Promise<void> {
  const payload = data ?? loadPortfolio()
  if (!hasPortfolioData(payload) && payload.name === defaultPortfolio().name) {
    /* evita sobrescrever nuvem com carteira vazia por defeito */
    return
  }
  await pushNeonSync('portfolio', payload)
}

export function initPortfolioNeonSync(): () => void {
  if (typeof window === 'undefined') return () => {}

  void pullPortfolioFromNeon()

  return () => {
    if (pushTimer) clearTimeout(pushTimer)
  }
}
