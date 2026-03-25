import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const chain = req.nextUrl.searchParams.get('chain') || 'Ethereum'
  const res = await fetch(
    `https://api.llama.fi/v2/historicalChainTvl/${encodeURIComponent(chain)}`,
    { next: { revalidate: 600 } }
  )
  if (!res.ok) {
    return NextResponse.json([], { status: 502 })
  }
  return NextResponse.json(await res.json())
}
