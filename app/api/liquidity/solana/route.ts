import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { getSolanaPositions } from '@/lib/liquidity/solana/spl-lp'

export const maxDuration = 45

function isValidSolanaAddress(s: string): boolean {
  try {
    new PublicKey(s)
    return true
  } catch {
    return false
  }
}

/**
 * Somente leitura: tokens SPL enriquecidos (heurística LP/preço via DexScreener).
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
  if (!address || !isValidSolanaAddress(address)) {
    return NextResponse.json({ error: 'invalid_solana_address' }, { status: 400 })
  }

  try {
    const result = await getSolanaPositions(address)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error'
    return NextResponse.json(
      {
        positions: [],
        meta: { source: 'solana-spl', warning: message },
        error: 'fetch_failed',
      },
      { status: 502 },
    )
  }
}
