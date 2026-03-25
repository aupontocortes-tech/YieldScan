import { NextRequest, NextResponse } from 'next/server'
import type { Pool } from '@/lib/types'
import { selectLlamaPools } from '@/lib/llama-pools-select'

export const maxDuration = 25

/**
 * Apenas DefiLlama (Meteora fica em /api/meteora-pools) para não estourar timeout
 * no Vercel (~10s no plano hobby) ao somar download grande + muitas requisições.
 */
export async function GET(req: NextRequest) {
  const minTvl = Math.max(0, Number(req.nextUrl.searchParams.get('minTvl')) || 10_000)
  const cap = Math.min(12_000, Math.max(2500, Number(req.nextUrl.searchParams.get('cap')) || 8000))

  try {
    const llamaRes = await fetch('https://yields.llama.fi/pools', {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(18_000),
    })

    if (!llamaRes.ok) {
      return NextResponse.json({ error: 'defillama_pools' }, { status: 502 })
    }

    const body = (await llamaRes.json()) as { data?: Pool[] }
    const raw = body.data ?? []
    const llama = selectLlamaPools(raw, minTvl, cap)

    return NextResponse.json({ data: llama })
  } catch {
    return NextResponse.json(
      { error: 'defillama_timeout', message: 'DefiLlama demorou demais ou ficou indisponível.' },
      { status: 504 }
    )
  }
}
