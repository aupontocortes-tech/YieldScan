'use client'

import { useQueries, useQuery } from '@tanstack/react-query'
import type { LiquidityPosition, LiquidityPositionsResult } from '@/lib/liquidity/types'
import type { WalletChain } from '@/hooks/use-wallet'
import type { SavedWallet } from '@/hooks/use-multi-wallet'

async function fetchLiquidity(
  chain: WalletChain,
  address: string,
  evmChainId?: number,
): Promise<LiquidityPositionsResult> {
  const path = chain === 'ethereum' ? '/api/liquidity/ethereum' : '/api/liquidity/solana'
  const body =
    chain === 'ethereum'
      ? { address, chainId: evmChainId ?? 1 }
      : { address }
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as LiquidityPositionsResult & { error?: string }
  if (!res.ok) {
    if (res.status === 400 && data.error === 'unsupported_chain') {
      throw new Error(
        'Esta rede ainda não tem leitura de pools Uniswap v3 nesta app. Escolhe outra rede na carteira ou usa Adicionar endereço com a rede correcta.',
      )
    }
    throw new Error(data.meta?.warning || data.error || `http_${res.status}`)
  }
  return {
    positions: data.positions ?? [],
    meta: data.meta ?? { source: 'unknown' },
  }
}

const REFETCH_MS = 45_000
const STALE_MS = 30_000

/** Hook legado — carteira única. Mantido para compatibilidade interna. */
export function useLiquidityPositions(opts: {
  chain: WalletChain | null
  address: string | null
  evmChainId?: number
  enabled: boolean
}) {
  const { chain, address, evmChainId, enabled } = opts
  return useQuery({
    queryKey: ['liquidity-positions', chain, evmChainId ?? 1, address],
    queryFn: () => fetchLiquidity(chain!, address!, evmChainId),
    enabled: Boolean(enabled && chain && address),
    staleTime: STALE_MS,
    gcTime: 5 * 60_000,
    refetchInterval: REFETCH_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

export type PositionWithWallet = LiquidityPosition & {
  walletId: string
  walletAddress: string
  walletChain: WalletChain
  walletEvmChainId?: number
}

export type LiquidityFetchError = {
  walletId: string
  walletAddress: string
  walletChain: WalletChain
  walletEvmChainId?: number
  message: string
}

/** Hook multi-carteira — agrega posições de todas as carteiras guardadas. */
export function useMultiLiquidityPositions(wallets: SavedWallet[]) {
  const queries = useQueries({
    queries: wallets.map((w) => ({
      queryKey: ['liquidity-positions', w.chain, w.evmChainId ?? 1, w.address],
      queryFn: () => fetchLiquidity(w.chain, w.address, w.evmChainId),
      staleTime: STALE_MS,
      gcTime: 5 * 60_000,
      refetchInterval: REFETCH_MS,
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  })

  const positions: PositionWithWallet[] = []
  const warnings: string[] = []
  const fetchErrors: LiquidityFetchError[] = []
  let isLoading = wallets.length > 0 && queries.every((q) => q.isLoading)
  const isFetching = queries.some((q) => q.isFetching)
  const isError = queries.some((q) => q.isError)

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i]!
    const w = wallets[i]!
    if (q.isError) {
      const err = q.error
      fetchErrors.push({
        walletId: w.id,
        walletAddress: w.address,
        walletChain: w.chain,
        walletEvmChainId: w.evmChainId,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    if (q.data) {
      for (const p of q.data.positions) {
        positions.push({
          ...p,
          walletId: w.id,
          walletAddress: w.address,
          walletChain: w.chain,
          walletEvmChainId: w.evmChainId,
        })
      }
      if (q.data.meta.warning) warnings.push(q.data.meta.warning)
    }
  }

  positions.sort((a, b) => b.valueUSD - a.valueUSD)

  return {
    positions,
    isLoading,
    isFetching,
    isError,
    fetchErrors,
    warnings,
    queries,
    refetchAll: () => queries.forEach((q) => void q.refetch()),
  }
}
