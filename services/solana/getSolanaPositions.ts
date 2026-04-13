import type { LiquidityPositionsResult } from '@/lib/liquidity/types'

export async function fetchSolanaLiquidityPositions(walletAddress: string): Promise<LiquidityPositionsResult> {
  const res = await fetch('/api/liquidity/solana', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: walletAddress }),
  })
  const data = (await res.json()) as LiquidityPositionsResult & { error?: string }
  if (!res.ok) {
    throw new Error(data.meta?.warning || data.error || `http_${res.status}`)
  }
  return {
    positions: data.positions ?? [],
    meta: data.meta ?? { source: 'solana' },
  }
}
