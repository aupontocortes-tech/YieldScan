import { NextRequest, NextResponse } from 'next/server'
import type { Pool } from '@/lib/types'
import { selectLlamaPools } from '@/lib/llama-pools-select'
import { fetchMeteoraDlmmPools } from '@/lib/meteora-dlmm'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const minTvl = Math.max(0, Number(req.nextUrl.searchParams.get('minTvl')) || 10_000)
  const cap = Math.min(12_000, Math.max(2500, Number(req.nextUrl.searchParams.get('cap')) || 8000))

  const llamaRes = await fetch('https://yields.llama.fi/pools', {
    next: { revalidate: 120 },
  })

  if (!llamaRes.ok) {
    return NextResponse.json({ error: 'defillama_pools' }, { status: 502 })
  }

  const body = (await llamaRes.json()) as { data?: Pool[] }
  const raw = body.data ?? []
  const llama = selectLlamaPools(raw, minTvl, cap)

  let meteora: Pool[] = []
  try {
    meteora = await fetchMeteoraDlmmPools({
      minTvlUsd: minTvl,
      maxPages: 14,
      pageSize: 100,
    })
  } catch {
    meteora = []
  }

  const seen = new Set<string>()
  const merged: Pool[] = []
  for (const p of [...meteora, ...llama]) {
    if (seen.has(p.pool)) continue
    seen.add(p.pool)
    merged.push(p)
  }
  merged.sort((a, b) => b.tvlUsd - a.tvlUsd)
  const limited = merged.slice(0, cap + 400)

  return NextResponse.json({ data: limited })
}
