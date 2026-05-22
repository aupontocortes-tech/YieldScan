import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type GeckoPrice = Record<string, { usd?: number; usd_24h_change?: number | null }>

export async function GET(req: Request) {
  const url = new URL(req.url)
  const coinId = (url.searchParams.get('id') ?? 'bitcoin').replace(/[^a-z0-9_-]/gi, '') || 'bitcoin'

  const out = {
    coingecko: null as { usd: number; change24h: number | null; id: string } | null,
    defiTvlUsd: null as number | null,
    hashRateEH: null as number | null,
    errors: [] as string[],
  }

  try {
    const gRes = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 0 }, signal: AbortSignal.timeout(12_000) }
    )
    if (gRes.ok) {
      const j = (await gRes.json()) as GeckoPrice
      const b = j[coinId]
      if (b?.usd != null) {
        out.coingecko = { usd: b.usd, change24h: b.usd_24h_change ?? null, id: coinId }
      }
    } else out.errors.push(`coingecko ${gRes.status}`)
  } catch {
    out.errors.push('coingecko fetch')
  }

  try {
    const lRes = await fetch('https://api.llama.fi/v2/historical/global', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(12_000),
    })
    if (lRes.ok) {
      const arr = (await lRes.json()) as { totalLiquidityUSD?: number }[]
      const last = Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : null
      if (last?.totalLiquidityUSD != null) out.defiTvlUsd = last.totalLiquidityUSD
    } else out.errors.push(`llama ${lRes.status}`)
  } catch {
    out.errors.push('defillama fetch')
  }

  try {
    const bRes = await fetch('https://api.blockchain.info/stats', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(12_000),
    })
    if (bRes.ok) {
      const j = (await bRes.json()) as { hash_rate?: number }
      if (j.hash_rate != null) out.hashRateEH = j.hash_rate / 1e18
    }
  } catch {
    /* optional */
  }

  return NextResponse.json(out, {
    headers: { 'Cache-Control': 'public, s-maxage=45, stale-while-revalidate=120' },
  })
}
