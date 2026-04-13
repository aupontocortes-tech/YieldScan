import type { LiquidityPositionsResult } from '@/lib/liquidity/types'

/**
 * Cliente: obtém posições Uniswap v3 via API Next (leitura só).
 */
export async function fetchUniswapPositions(
  walletAddress: string,
  chainId: number,
): Promise<LiquidityPositionsResult> {
  const res = await fetch('/api/liquidity/ethereum', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: walletAddress, chainId }),
  })
  const data = (await res.json()) as LiquidityPositionsResult & { error?: string }
  if (!res.ok) {
    if (res.status === 400 && data.error === 'unsupported_chain') {
      return {
        positions: [],
        meta: {
          source: 'uniswap-v3',
          warning: `Chain ${chainId} não suportada para Uniswap v3 nesta app.`,
        },
      }
    }
    if (res.status === 400 && data.error === 'invalid_ethereum_address') {
      throw new Error(
        'Endereço EVM inválido (esperado 0x…). Liga a carteira EVM ou remove dados antigos da sessão.',
      )
    }
    throw new Error(data.meta?.warning || data.error || `http_${res.status}`)
  }
  return {
    positions: data.positions ?? [],
    meta: data.meta ?? { source: 'uniswap-v3' },
  }
}
