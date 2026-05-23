import type {
  UnlocksPeriod,
  UpcomingUnlock,
  UnlockSchedulePoint,
  UnlockTokenProfile,
  UnlocksApiResponse,
} from '@/services/api/types/unlocks'
import { formatUnlockType } from '@/lib/unlocks-format'
import { classifyImpact, getUnlockAlert } from '@/lib/unlocks-impact'
import { buildVestingTimeline, type VestingTimeline } from '@/lib/unlocks-vesting-timeline'
import {
  extractGeckoId,
  sumEventTokens,
  type DefillamaEmissionEvent,
  type DefillamaEmissionToken,
} from '@/services/api/defillama-emissions'
import type { CoingeckoMarketRow } from '@/services/api/coingecko-supply'

const MS_DAY = 86_400_000
const SCHEDULE_HORIZON_MS = 90 * MS_DAY

function periodToMs(period: UnlocksPeriod): number {
  switch (period) {
    case '7d':
      return 7 * MS_DAY
    case '30d':
      return 30 * MS_DAY
    case '90d':
      return 90 * MS_DAY
  }
}

function vestingFromMarket(m: CoingeckoMarketRow): VestingTimeline {
  const circ = m.circulating_supply ?? 0
  const max = m.max_supply ?? m.total_supply ?? circ
  const remaining = Math.max(0, max - circ)
  const nowMs = Date.now()
  const MS_DAY = 86_400_000
  const label = (ts: number) =>
    new Date(ts).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
  if (remaining <= 0) {
    return {
      points: [{ timestamp: nowMs, label: label(nowMs), Circulante: circ }],
      categories: ['Circulante'],
      futureUnlocks: [],
    }
  }
  return {
    points: [
      { timestamp: nowMs, label: label(nowMs), Circulante: circ, Pendente: remaining },
      {
        timestamp: nowMs + 365 * MS_DAY,
        label: label(nowMs + 365 * MS_DAY),
        Circulante: circ,
        Pendente: remaining,
      },
    ],
    categories: ['Circulante', 'Pendente'],
    futureUnlocks: [],
  }
}

function pct(part: number, whole: number | null | undefined): number | null {
  if (!whole || whole <= 0 || !Number.isFinite(part)) return null
  return (part / whole) * 100
}

function toMs(ts: number): number {
  return ts > 1e12 ? ts : ts * 1000
}

function isInPeriod(tsMs: number, period: UnlocksPeriod, nowMs: number): boolean {
  return tsMs >= nowMs && tsMs <= nowMs + periodToMs(period)
}

export function computeReleasedRemaining(
  circ: number | null,
  maxSupply: number | null,
  locked: number | null
): { releasedPct: number | null; remainingPct: number | null } {
  if (maxSupply != null && maxSupply > 0 && circ != null && circ >= 0) {
    const released = Math.min(100, Math.max(0, (circ / maxSupply) * 100))
    return { releasedPct: released, remainingPct: Math.max(0, 100 - released) }
  }
  if (maxSupply != null && maxSupply > 0 && locked != null && locked >= 0) {
    const remaining = Math.min(100, Math.max(0, (locked / maxSupply) * 100))
    return { releasedPct: Math.max(0, 100 - remaining), remainingPct: remaining }
  }
  return { releasedPct: null, remainingPct: null }
}

function buildSchedulePoint(
  tsMs: number,
  tokens: number,
  priceUsd: number | null,
  circ: number | null,
  maxSupply: number | null,
  unlockTypeRaw: string | null | undefined
): UnlockSchedulePoint {
  const inflationPct = pct(tokens, circ)
  return {
    timestamp: tsMs,
    dateLabel: new Date(tsMs).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }),
    tokens,
    usdValue: priceUsd && tokens > 0 ? tokens * priceUsd : null,
    unlockType: formatUnlockType(unlockTypeRaw),
    inflationPct,
    supplyPct: pct(tokens, maxSupply),
    impact: classifyImpact(inflationPct),
  }
}

function buildScheduleFromEmission(
  row: DefillamaEmissionToken,
  priceUsd: number | null,
  circ: number | null,
  maxSupply: number | null,
  nowMs: number
): UnlockSchedulePoint[] {
  const points: UnlockSchedulePoint[] = []
  for (const ev of row.events ?? []) {
    const ts = ev.timestamp
    if (!ts) continue
    const tsMs = toMs(ts)
    if (tsMs < nowMs || tsMs > nowMs + SCHEDULE_HORIZON_MS) continue
    const amount = sumEventTokens(ev)
    if (amount <= 0) continue
    points.push(buildSchedulePoint(tsMs, amount, priceUsd, circ, maxSupply, ev.unlockType))
  }
  points.sort((a, b) => a.timestamp - b.timestamp)
  return points
}

function toUpcoming(
  ctx: {
    geckoId: string | null
    symbol: string
    name: string
    image: string | null
    priceUsd: number | null
    circ: number | null
    maxSupply: number | null
    id: string
  },
  unlockAtSec: number,
  tokensAmount: number,
  unlockTypeRaw: string | null | undefined
): UpcomingUnlock {
  const unlockAt = toMs(unlockAtSec)
  const inflationPct = pct(tokensAmount, ctx.circ)
  return {
    id: `${ctx.id}-${unlockAt}-${tokensAmount}`,
    geckoId: ctx.geckoId,
    symbol: ctx.symbol,
    name: ctx.name,
    image: ctx.image,
    unlockAt,
    tokens: tokensAmount,
    usdValue: ctx.priceUsd && tokensAmount > 0 ? tokensAmount * ctx.priceUsd : null,
    inflationPct,
    supplyPct: pct(tokensAmount, ctx.maxSupply),
    unlockType: formatUnlockType(unlockTypeRaw),
    impact: classifyImpact(inflationPct),
  }
}

function annualInflationFromEmission(
  unlocksPerDay: number | undefined,
  circ: number | null
): number | null {
  if (!circ || circ <= 0 || !unlocksPerDay || unlocksPerDay <= 0) return null
  return ((unlocksPerDay * 365) / circ) * 100
}

type ProfileCore = Pick<
  UnlockTokenProfile,
  | 'geckoId'
  | 'symbol'
  | 'name'
  | 'image'
  | 'releasedPct'
  | 'remainingPct'
  | 'hasUnlockInPeriod'
  | 'nextUnlockAt'
  | 'nextUnlockTokens'
  | 'nextUnlockUsd'
  | 'nextUnlockType'
  | 'nextInflationPct'
  | 'nextSupplyPct'
>

function enrichProfile(
  core: ProfileCore,
  market?: CoingeckoMarketRow,
  row?: DefillamaEmissionToken
): UnlockTokenProfile {
  const circ = market?.circulating_supply ?? row?.circSupply ?? row?.circSupply30d ?? null
  const maxSupply = market?.max_supply ?? row?.maxSupply ?? market?.total_supply ?? null
  const nextImpact = classifyImpact(core.nextInflationPct)
  const price = market?.current_price ?? null
  const remainingTokens =
    maxSupply != null && circ != null && maxSupply > circ
      ? maxSupply - circ
      : row?.totalLocked ?? null
  const remainingUsd =
    remainingTokens != null && remainingTokens > 0 && price
      ? remainingTokens * price
      : null

  return {
    ...core,
    circulatingSupply: circ,
    totalSupply: market?.total_supply ?? null,
    maxSupply,
    marketCap: market?.market_cap ?? row?.mcap ?? null,
    annualInflationPct: annualInflationFromEmission(row?.unlocksPerDay, circ),
    nextImpact,
    alert: getUnlockAlert(core.nextUnlockAt, nextImpact),
    remainingTokens,
    remainingUsd,
  }
}

function profileFromMarket(
  m: CoingeckoMarketRow,
  hasUnlockInPeriod: boolean,
  next: {
    at: number | null
    tokens: number | null
    type: string
    inflationPct: number | null
    supplyPct: number | null
  }
): UnlockTokenProfile {
  const circ = m.circulating_supply
  const max = m.max_supply ?? m.total_supply
  const locked = max != null && circ != null && max > circ ? max - circ : null
  const { releasedPct, remainingPct } = computeReleasedRemaining(circ, max, locked)
  const price = m.current_price

  return enrichProfile(
    {
      geckoId: m.id,
      symbol: m.symbol.toUpperCase(),
      name: m.name,
      image: m.image,
      releasedPct,
      remainingPct,
      hasUnlockInPeriod,
      nextUnlockAt: next.at,
      nextUnlockTokens: next.tokens,
      nextUnlockUsd:
        price && next.tokens && next.tokens > 0 ? next.tokens * price : null,
      nextUnlockType: next.type,
      nextInflationPct: next.inflationPct,
      nextSupplyPct: next.supplyPct,
    },
    m
  )
}

export function normalizeUnlocksPayload(input: {
  emissions: DefillamaEmissionToken[]
  markets: CoingeckoMarketRow[]
  period: UnlocksPeriod
}): UnlocksApiResponse {
  const marketById = new Map(input.markets.map((m) => [m.id, m]))
  const nowMs = Date.now()
  const upcoming: UpcomingUnlock[] = []
  const scheduleByGeckoId: Record<string, UnlockSchedulePoint[]> = {}
  const vestingByGeckoId: Record<string, VestingTimeline> = {}
  const catalog: UnlockTokenProfile[] = []

  for (const row of input.emissions) {
    const geckoId = extractGeckoId(row)
    if (!geckoId) continue

    const market = marketById.get(geckoId)
    const priceUsd = market?.current_price ?? null
    const symbol = (market?.symbol ?? row.name ?? geckoId).toUpperCase()
    const name = market?.name ?? row.name ?? symbol
    const maxSupply = market?.max_supply ?? row.maxSupply ?? null
    const circ = market?.circulating_supply ?? row.circSupply ?? row.circSupply30d ?? null
    const image = market?.image ?? null
    const id = geckoId
    const locked = row.totalLocked ?? (maxSupply && circ ? maxSupply - circ : null)

    const ctx = { id, geckoId, symbol, name, image, priceUsd, circ, maxSupply }

    scheduleByGeckoId[geckoId] = buildScheduleFromEmission(row, priceUsd, circ, maxSupply, nowMs)
    vestingByGeckoId[geckoId] = buildVestingTimeline(row, priceUsd, nowMs)

    let hasUnlockInPeriod = false
    const pushIfInPeriod = (
      unlockAtSec: number,
      tokensAmount: number,
      meta?: DefillamaEmissionEvent
    ) => {
      if (!isInPeriod(toMs(unlockAtSec), input.period, nowMs)) return
      hasUnlockInPeriod = true
      upcoming.push(
        toUpcoming(ctx, unlockAtSec, tokensAmount, meta?.unlockType ?? 'cliff')
      )
    }

    const nextAt = row.nextEvent?.date
    const nextTokens = row.nextEvent?.toUnlock ?? null
    if (nextAt && nextTokens && nextTokens > 0) {
      pushIfInPeriod(nextAt, nextTokens, { unlockType: 'cliff' })
    }

    for (const ev of row.events ?? []) {
      const ts = ev.timestamp
      if (!ts) continue
      const amount = sumEventTokens(ev)
      if (amount <= 0) continue
      pushIfInPeriod(ts, amount, ev)
    }

    const { releasedPct, remainingPct } = computeReleasedRemaining(circ, maxSupply, locked)

    catalog.push(
      enrichProfile(
        {
          geckoId,
          symbol,
          name,
          image,
          releasedPct,
          remainingPct,
          hasUnlockInPeriod,
          nextUnlockAt: nextAt ? toMs(nextAt) : null,
          nextUnlockTokens: nextTokens,
          nextUnlockUsd:
            priceUsd && nextTokens && nextTokens > 0 ? nextTokens * priceUsd : null,
          nextUnlockType: formatUnlockType('cliff'),
          nextInflationPct: nextTokens ? pct(nextTokens, circ) : null,
          nextSupplyPct: nextTokens ? pct(nextTokens, maxSupply) : null,
        },
        market,
        row
      )
    )
  }

  const seen = new Set<string>()
  const deduped = upcoming.filter((u) => {
    const key = `${u.geckoId}-${u.unlockAt}-${u.tokens}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return {
    updatedAt: Date.now(),
    catalog,
    upcoming: deduped,
    scheduleByGeckoId,
    vestingByGeckoId,
  }
}

export function normalizeCoingeckoFallbackPayload(input: {
  markets: CoingeckoMarketRow[]
  period: UnlocksPeriod
}): UnlocksApiResponse {
  const upcoming: UpcomingUnlock[] = []
  const scheduleByGeckoId: Record<string, UnlockSchedulePoint[]> = {}
  const vestingByGeckoId: Record<string, VestingTimeline> = {}
  const catalog: UnlockTokenProfile[] = []

  for (const m of input.markets) {
    const circ = m.circulating_supply
    const max = m.max_supply ?? m.total_supply
    const price = m.current_price
    const remaining = max != null && circ != null && max > circ ? max - circ : null
    if (remaining == null || remaining <= 0) continue

    const inflationPct = pct(remaining, circ)
    const hasUnlockInPeriod = true

    catalog.push(
      profileFromMarket(m, hasUnlockInPeriod, {
        at: null,
        tokens: remaining,
        type: 'Pendente',
        inflationPct,
        supplyPct: pct(remaining, max),
      })
    )

    const supplyPctVal = pct(remaining, max)
    upcoming.push({
      id: `pending-${m.id}`,
      geckoId: m.id,
      symbol: m.symbol.toUpperCase(),
      name: m.name,
      image: m.image,
      unlockAt: null,
      tokens: remaining,
      usdValue: price ? remaining * price : null,
      inflationPct,
      supplyPct: supplyPctVal,
      unlockType: 'Pendente',
      impact: classifyImpact(inflationPct),
    })

    scheduleByGeckoId[m.id] = [
      {
        timestamp: Date.now(),
        dateLabel: 'Agora',
        tokens: remaining,
        usdValue: price ? remaining * price : null,
        unlockType: 'Pendente',
        inflationPct,
        supplyPct: supplyPctVal,
        impact: classifyImpact(inflationPct),
      },
    ]
    vestingByGeckoId[m.id] = vestingFromMarket(m)
  }

  upcoming.sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0))

  return {
    updatedAt: Date.now(),
    catalog,
    upcoming: upcoming.slice(0, 120),
    scheduleByGeckoId,
    vestingByGeckoId,
  }
}

/** Moeda extra (pesquisa) só com dados CoinGecko. */
export function appendCoingeckoOnlyProfiles(
  payload: UnlocksApiResponse,
  markets: CoingeckoMarketRow[]
): UnlocksApiResponse {
  const existing = new Set(payload.catalog.map((c) => c.geckoId))
  const scheduleByGeckoId = { ...payload.scheduleByGeckoId }
  const vestingByGeckoId = { ...payload.vestingByGeckoId }

  for (const m of markets) {
    if (existing.has(m.id)) continue
    const circ = m.circulating_supply
    const max = m.max_supply ?? m.total_supply
    const remaining = max != null && circ != null && max > circ ? max - circ : null
    if (remaining == null || remaining <= 0) continue

    payload.catalog.push(
      profileFromMarket(m, false, {
        at: null,
        tokens: remaining,
        type: '—',
        inflationPct: pct(remaining, circ),
        supplyPct: pct(remaining, max),
      })
    )

    const infl = pct(remaining, circ)
    scheduleByGeckoId[m.id] = [
      {
        timestamp: Date.now(),
        dateLabel: 'Supply',
        tokens: remaining,
        usdValue: m.current_price ? remaining * m.current_price : null,
        unlockType: '—',
        inflationPct: infl,
        supplyPct: pct(remaining, max),
        impact: classifyImpact(infl),
      },
    ]
    vestingByGeckoId[m.id] = vestingFromMarket(m)
    existing.add(m.id)
  }

  return { ...payload, scheduleByGeckoId, vestingByGeckoId }
}

export function filterAndSortUnlocks(
  payload: UnlocksApiResponse,
  sort: 'unlock' | 'soonest'
): UnlocksApiResponse {
  const upcoming = [...payload.upcoming]
  const catalog = [...payload.catalog]

  const sortCatalog = () => {
    if (sort === 'unlock') {
      catalog.sort((a, b) => (b.remainingUsd ?? 0) - (a.remainingUsd ?? 0))
    } else {
      catalog.sort((a, b) => {
        if (a.nextUnlockAt == null && b.nextUnlockAt == null) {
          return (b.remainingPct ?? 0) - (a.remainingPct ?? 0)
        }
        if (a.nextUnlockAt == null) return 1
        if (b.nextUnlockAt == null) return -1
        return a.nextUnlockAt - b.nextUnlockAt
      })
    }
  }

  sortCatalog()

  if (sort === 'unlock') {
    upcoming.sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0))
  } else {
    upcoming.sort((a, b) => {
      if (a.unlockAt == null && b.unlockAt == null) return (b.usdValue ?? 0) - (a.usdValue ?? 0)
      if (a.unlockAt == null) return 1
      if (b.unlockAt == null) return -1
      return a.unlockAt - b.unlockAt
    })
  }

  return { ...payload, upcoming, catalog }
}
