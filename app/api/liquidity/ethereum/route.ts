import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'ethers'
import { isSupportedEvmUniswapChainId } from '@/lib/liquidity/ethereum/evm-chain-meta'
import { getEthereumPositions } from '@/lib/liquidity/ethereum/uniswap-v3'

export const maxDuration = 30

/**
 * Somente leitura: posições Uniswap v3 (Ethereum, Arbitrum, Base, Polygon).
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

  let chainId = 1
  if (typeof body === 'object' && body !== null && 'chainId' in body) {
    const raw = (body as { chainId?: unknown }).chainId
    const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw)
    if (Number.isFinite(n)) chainId = Math.trunc(n)
  }
  if (!isSupportedEvmUniswapChainId(chainId)) {
    return NextResponse.json(
      { error: 'unsupported_chain', positions: [], meta: { source: 'uniswap-v3' } },
      { status: 400 },
    )
  }

  try {
    const result = await getEthereumPositions(address, chainId)
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
