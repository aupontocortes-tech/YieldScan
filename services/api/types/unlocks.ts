import type { ImpactLevel, UnlockAlert } from '@/lib/unlocks-impact'

export type UnlocksPeriod = '7d' | '30d' | '90d'

export type UnlocksSortMode = 'unlock' | 'soonest'

export type UnlockTokenProfile = {
  geckoId: string
  symbol: string
  name: string
  image: string | null
  releasedPct: number | null
  remainingPct: number | null
  hasUnlockInPeriod: boolean
  nextUnlockAt: number | null
  nextUnlockTokens: number | null
  nextUnlockUsd: number | null
  nextUnlockType: string
  nextInflationPct: number | null
  nextSupplyPct: number | null
  nextImpact: ImpactLevel
  alert: UnlockAlert
  marketCap: number | null
  circulatingSupply: number | null
  totalSupply: number | null
  maxSupply: number | null
  annualInflationPct: number | null
  /** Tokens ainda por desbloquear (max − circ.). */
  remainingTokens: number | null
  /** Valor USD estimado do que falta desbloquear. */
  remainingUsd: number | null
}

export type UpcomingUnlock = {
  id: string
  geckoId: string | null
  symbol: string
  name: string
  image: string | null
  unlockAt: number | null
  tokens: number
  usdValue: number | null
  inflationPct: number | null
  supplyPct: number | null
  unlockType: string
  impact: ImpactLevel
}

export type UnlockSchedulePoint = {
  timestamp: number
  dateLabel: string
  tokens: number
  usdValue: number | null
  unlockType: string
  inflationPct: number | null
  supplyPct: number | null
  impact: ImpactLevel
}

export type { VestingTimeline, VestingFutureUnlock } from '@/lib/unlocks-vesting-timeline'

export type UnlocksApiResponse = {
  updatedAt: number
  catalog: UnlockTokenProfile[]
  upcoming: UpcomingUnlock[]
  scheduleByGeckoId: Record<string, UnlockSchedulePoint[]>
  vestingByGeckoId: Record<string, import('@/lib/unlocks-vesting-timeline').VestingTimeline>
}
