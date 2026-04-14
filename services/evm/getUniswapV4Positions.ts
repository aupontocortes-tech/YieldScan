import type { LiquidityPositionsResult } from '@/lib/liquidity/types'

function v4ErrorMessage(status: number, error?: string, warning?: string): string {
  if (warning) return warning
  if (status === 400 && error === 'invalid_ethereum_address') {
    return 'Endereço EVM inválido (esperado 0x…).'
  }
  if (error) return error
  return `http_${status}`
}

export async function fetchUniswapV4Positions(
  walletAddress: string,
  chainId: number,
): Promise<LiquidityPositionsResult> {
  const res = await fetch('/api/liquidity/uniswap-v4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: walletAddress, chainId }),
  })
  const data = (await res.json()) as LiquidityPositionsResult & { error?: string }
  if (!res.ok) {
    throw new Error(v4ErrorMessage(res.status, data.error, data.meta?.warning))
  }
  return {
    positions: data.positions ?? [],
    meta: data.meta ?? { source: 'uniswap-v4' },
  }
}
