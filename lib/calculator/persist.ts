import { scheduleNeonPush } from '@/lib/neon/sync-schedule'

const STORAGE_KEY = 'yieldscan-calculator-v3'
const STORAGE_KEY_LEGACY = 'yieldscan-calculator-v2'

export type CalculatorAsset = {
  id: string
  type: 'crypto' | 'fiat'
  symbol?: string
  name?: string
}

export type CalculatorPersistV3 = {
  v: 3
  leftAsset: CalculatorAsset
  rightAsset: CalculatorAsset
  leftAmount: string
  rightAmount: string
  lastEdited: 'left' | 'right'
}

export function readCalculatorPersist(): CalculatorPersistV3 | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY_LEGACY)
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<CalculatorPersistV3>
    if (j.v !== 3 || !j.leftAsset?.id || !j.rightAsset?.id) return null
    return {
      v: 3,
      leftAsset: j.leftAsset,
      rightAsset: j.rightAsset,
      leftAmount: typeof j.leftAmount === 'string' ? j.leftAmount : '',
      rightAmount: typeof j.rightAmount === 'string' ? j.rightAmount : '',
      lastEdited: j.lastEdited === 'right' ? 'right' : 'left',
    }
  } catch {
    return null
  }
}

export function writeCalculatorPersist(state: CalculatorPersistV3, opts?: { skipNeon?: boolean }): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
  if (!opts?.skipNeon) scheduleNeonPush('calculator')
}
