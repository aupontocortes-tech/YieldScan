import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'ethers'
import { isSupportedEvmUniswapChainId } from '@/lib/liquidity/ethereum/evm-chain-meta'
import { getUniswapV4PositionsOnChain } from '@/lib/liquidity/ethereum/uniswap-v4-onchain'

export const maxDuration = 45

/**
 * Somente leitura: posições Uniswap v4 (NFT + StateView) nas redes EVM suportadas.
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
      { error: 'unsupported_chain', positions: [], meta: { source: 'uniswap-v4' } },
      { status: 400 },
    )
  }

  try {
    const result = await getUniswapV4PositionsOnChain(address, chainId)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error'
    return NextResponse.json(
      {
        positions: [],
        meta: { source: 'uniswap-v4', warning: message },
        error: 'fetch_failed',
      },
      { status: 502 },
    )
  }
}
