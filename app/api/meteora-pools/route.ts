import { NextRequest, NextResponse } from 'next/server'
import { fetchMeteoraDlmmPoolsParallel } from '@/lib/meteora-dlmm'

export const maxDuration = 25

/** Só Meteora DLMM — rota leve, roda em paralelo com /api/pools no cliente. */
export async function GET(req: NextRequest) {
  const minTvl = Math.max(0, Number(req.nextUrl.searchParams.get('minTvl')) || 10_000)
  const maxPagesRaw = req.nextUrl.searchParams.get('maxPages')
  const maxPages =
    maxPagesRaw != null
      ? Math.min(8, Math.max(1, Number(maxPagesRaw) || 4))
      : 8
  const pages = Array.from({ length: maxPages }, (_, i) => i + 1)

  try {
    const pools = await fetchMeteoraDlmmPoolsParallel({
      minTvlUsd: minTvl,
      pages,
      pageSize: 100,
      perRequestMs: 9000,
    })
    const res = NextResponse.json({ data: pools })
    res.headers.set('X-Meteora-Count', String(pools.length))
    return res
  } catch {
    return NextResponse.json({ data: [] })
  }
}
