import { isRemoteNewer, pullNeonSync, pushNeonSync } from '@/lib/neon/sync-client'
import { writeSyncMeta } from '@/lib/neon/sync-meta'

export const NEON_INDICATORS_CHANGED = 'yieldscan-neon-indicators-changed'

const BTC_LS_MIRROR = 'yieldscan_btc_layout_v2'
const DRAWING_STORE_KEY = 'yieldscan:drawing-system-v2'

export type IndicatorsNeonPayload = {
  v: 1
  btcLayout: unknown | null
  drawings: unknown | null
  exportedAt: string
}

let pushTimer: ReturnType<typeof setTimeout> | null = null

function readLocalIndicatorsPayload(): IndicatorsNeonPayload {
  let btcLayout: unknown | null = null
  let drawings: unknown | null = null
  try {
    const rawBtc = localStorage.getItem(BTC_LS_MIRROR)
    if (rawBtc) btcLayout = JSON.parse(rawBtc) as unknown
  } catch {
    /* ignore */
  }
  try {
    const rawDraw = localStorage.getItem(DRAWING_STORE_KEY)
    if (rawDraw) drawings = JSON.parse(rawDraw) as unknown
  } catch {
    /* ignore */
  }
  return { v: 1, btcLayout, drawings, exportedAt: new Date().toISOString() }
}

function hasLocalIndicators(payload: IndicatorsNeonPayload): boolean {
  return payload.btcLayout != null || payload.drawings != null
}

function applyIndicatorsPayload(payload: IndicatorsNeonPayload): void {
  try {
    if (payload.btcLayout != null) {
      localStorage.setItem(BTC_LS_MIRROR, JSON.stringify(payload.btcLayout))
    }
    if (payload.drawings != null) {
      localStorage.setItem(DRAWING_STORE_KEY, JSON.stringify(payload.drawings))
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NEON_INDICATORS_CHANGED))
  }
}

function isIndicatorsPayload(v: unknown): v is IndicatorsNeonPayload {
  return Boolean(v && typeof v === 'object' && (v as IndicatorsNeonPayload).v === 1)
}

export async function pullIndicatorsFromNeon(): Promise<boolean> {
  const remote = await pullNeonSync('indicators')
  if (!remote.configured || !remote.ok || !remote.payload) return false
  if (!isIndicatorsPayload(remote.payload)) return false

  const local = readLocalIndicatorsPayload()
  const shouldImport = isRemoteNewer('indicators', remote.updatedAt) || !hasLocalIndicators(local)
  if (!shouldImport) return false

  applyIndicatorsPayload(remote.payload)
  if (remote.updatedAt) writeSyncMeta('indicators', remote.updatedAt)
  return true
}

export function schedulePushIndicatorsToNeon(): void {
  if (typeof window === 'undefined') return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void pushIndicatorsToNeonNow()
  }, 3000)
}

export async function pushIndicatorsToNeonNow(): Promise<void> {
  const payload = readLocalIndicatorsPayload()
  if (!hasLocalIndicators(payload)) return
  await pushNeonSync('indicators', payload)
}

export function initIndicatorsNeonSync(): () => void {
  if (typeof window === 'undefined') return () => {}

  void pullIndicatorsFromNeon()

  const onStorage = (e: StorageEvent) => {
    if (e.key === BTC_LS_MIRROR || e.key === DRAWING_STORE_KEY) {
      schedulePushIndicatorsToNeon()
    }
  }
  window.addEventListener('storage', onStorage)

  const poll = window.setInterval(() => {
    schedulePushIndicatorsToNeon()
  }, 120_000)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.clearInterval(poll)
    if (pushTimer) clearTimeout(pushTimer)
  }
}
