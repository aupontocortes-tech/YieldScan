import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const poolId = req.nextUrl.searchParams.get('poolId')
  if (!poolId || poolId.startsWith('meteora-dlmm-')) {
    return NextResponse.json([])
  }

  const res = await fetch(`https://yields.llama.fi/chart/${encodeURIComponent(poolId)}`, {
    next: { revalidate: 300 },
  })
  if (!res.ok) {
    return NextResponse.json([])
  }

  const body = (await res.json()) as { data?: unknown }
  return NextResponse.json(body.data ?? [])
}
