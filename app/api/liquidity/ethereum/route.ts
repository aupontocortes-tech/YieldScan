import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'ethers'
import { getEthereumPositions } from '@/lib/liquidity/ethereum/uniswap-v3'

export const maxDuration = 30

/**
 * Somente leitura: posições Uniswap v3 (Ethereum mainnet) via subgraph + SDK.
 */
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const address =
    typeof body === 'object' && body !== null && 'address' in body
      ? String((body as { address?: unknown }).address ?? '').trim()
      : ''
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: 'invalid_ethereum_address' }, { status: 400 })
  }

  try {
    const result = await getEthereumPositions(address)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error'
    return NextResponse.json(
      {
        positions: [],
        meta: { source: 'uniswap-v3', warning: message },
        error: 'fetch_failed',
      },
      { status: 502 },
    )
  }
}
