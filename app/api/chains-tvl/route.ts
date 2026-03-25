import { NextResponse } from 'next/server'
import { SUPPORTED_CHAINS } from '@/lib/types'

export const maxDuration = 30

export async function GET() {
  const res = await fetch('https://api.llama.fi/v2/chains', {
    next: { revalidate: 300 },
  })
  if (!res.ok) {
    return NextResponse.json({ error: 'chains' }, { status: 502 })
  }

  const data = (await res.json()) as { name: string; tvl: number }[]
  const supported = new Set(SUPPORTED_CHAINS.map((c) => c.id))
  const tvlByChain: Record<string, number> = {}

  for (const row of data) {
    if (supported.has(row.name)) {
      tvlByChain[row.name] = row.tvl
    }
  }

  return NextResponse.json(tvlByChain)
}
