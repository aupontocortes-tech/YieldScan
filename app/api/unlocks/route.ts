import { NextRequest, NextResponse } from 'next/server'
import { fetchDefillamaEmissions, extractGeckoId } from '@/services/api/defillama-emissions'
import { fetchCoingeckoMarketsByIds, fetchCoingeckoTopMarkets } from '@/services/api/coingecko-supply'
import {
  normalizeUnlocksPayload,
  normalizeCoingeckoFallbackPayload,
  appendCoingeckoOnlyProfiles,
  filterAndSortUnlocks,
} from '@/services/api/unlocks-normalize'
import type { UnlocksPeriod } from '@/services/api/types/unlocks'

export const maxDuration = 60

const PERIODS = new Set<UnlocksPeriod>(['7d', '30d', '90d'])
const SORTS = new Set(['unlock', 'soonest'])

function parseExtraIds(raw: string | null): string[] {
  if (!raw?.trim()) return []
  return [...new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z0-9_-]{2,64}$/.test(s)))].slice(
    0,
    20
  )
}

export async function GET(req: NextRequest) {
  const periodParam = req.nextUrl.searchParams.get('period') ?? '7d'
  const sortParam = req.nextUrl.searchParams.get('sort') ?? 'soonest'
  const extraIds = parseExtraIds(req.nextUrl.searchParams.get('ids'))
  const period = PERIODS.has(periodParam as UnlocksPeriod) ? (periodParam as UnlocksPeriod) : '7d'
  const sort = SORTS.has(sortParam) ? (sortParam as 'unlock' | 'soonest') : 'soonest'

  const { data: emissions } = await fetchDefillamaEmissions()

  let payload

  if (emissions.length > 0) {
    const geckoIds = emissions.map(extractGeckoId).filter((id): id is string => !!id)
    const allIds = [...new Set([...geckoIds, ...extraIds])]
    const markets = await fetchCoingeckoMarketsByIds(allIds)
    payload = normalizeUnlocksPayload({ emissions, markets, period })
    const missingExtra = extraIds.filter((id) => !payload.catalog.some((c) => c.geckoId === id))
    if (missingExtra.length) {
      const extraMarkets = await fetchCoingeckoMarketsByIds(missingExtra)
      payload = appendCoingeckoOnlyProfiles(payload, extraMarkets)
    }
  } else {
    const markets = await fetchCoingeckoTopMarkets(250)
    const extraMarkets =
      extraIds.length > 0 ? await fetchCoingeckoMarketsByIds(extraIds) : []
    const merged = [...markets]
    const seen = new Set(markets.map((m) => m.id))
    for (const m of extraMarkets) {
      if (!seen.has(m.id)) {
        merged.push(m)
        seen.add(m.id)
      }
    }
    payload = normalizeCoingeckoFallbackPayload({ markets: merged, period })
  }

  const sorted = filterAndSortUnlocks(payload, sort)
  return NextResponse.json(sorted, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
