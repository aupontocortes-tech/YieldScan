import type { LiquidityPositionsResult } from '@/lib/liquidity/types'

function solanaApiErrorMessage(status: number, error?: string, warning?: string): string {
  if (warning) return warning
  if (status === 400 && error === 'invalid_solana_address') {
    return 'Endereço Solana inválido (esperado base58 da Phantom). Se só tens EVM ligada, ignora ou liga Solana.'
  }
  if (status === 400 && error === 'invalid_json') {
    return 'Pedido inválido ao servidor Solana.'
  }
  if (error) return error
  return `http_${status}`
}

export async function fetchSolanaLiquidityPositions(walletAddress: string): Promise<LiquidityPositionsResult> {
  const res = await fetch('/api/liquidity/solana', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: walletAddress }),
  })
  const data = (await res.json()) as LiquidityPositionsResult & { error?: string }
  if (!res.ok) {
    throw new Error(
      solanaApiErrorMessage(res.status, data.error, data.meta?.warning),
    )
  }
  return {
    positions: data.positions ?? [],
    meta: data.meta ?? { source: 'solana' },
  }
}
