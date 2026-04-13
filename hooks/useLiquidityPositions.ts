'use client'

import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { useWallet } from '@solana/wallet-adapter-react'
import { AGGREGATOR_EVM_CHAIN_IDS } from '@/services/constants'
import { normalizePositions } from '@/services/normalize'
import { fetchUniswapPositions } from '@/services/evm/getUniswapPositions'
import { fetchSolanaLiquidityPositions } from '@/services/solana/getSolanaPositions'
import type { AggregatorFetchMeta, AggregatorLiquidityPosition } from '@/services/types'
import { EVM_UNISWAP_CHAIN_LABEL } from '@/lib/liquidity/ethereum/evm-chain-meta'
import type { SupportedEvmUniswapChainId } from '@/lib/liquidity/ethereum/evm-chain-meta'

const STALE_MS = 30_000
const REFETCH_MS = 60_000

function evmLabel(chainId: number): string {
  return EVM_UNISWAP_CHAIN_LABEL[chainId as SupportedEvmUniswapChainId] ?? `Chain ${chainId}`
}

export function useLiquidityPositions() {
  const { address: evmAddress, isConnected: evmConnected } = useAccount()
  const { publicKey, connected: solConnected } = useWallet()
  const solAddress = publicKey?.toBase58() ?? null

  const evmQueries = useQueries({
    queries: AGGREGATOR_EVM_CHAIN_IDS.map((chainId) => ({
      queryKey: ['aggregator', 'uniswap', chainId, evmAddress],
      queryFn: () => fetchUniswapPositions(evmAddress!, chainId),
      enabled: Boolean(evmConnected && evmAddress),
      staleTime: STALE_MS,
      gcTime: 10 * 60_000,
      refetchInterval: REFETCH_MS,
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  })

  const solQuery = useQuery({
    queryKey: ['aggregator', 'solana', solAddress],
    queryFn: () => fetchSolanaLiquidityPositions(solAddress!),
    enabled: Boolean(solConnected && solAddress),
    staleTime: STALE_MS,
    gcTime: 10 * 60_000,
    refetchInterval: REFETCH_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const aggregated = useMemo(() => {
    const warnings: string[] = []
    const errors: AggregatorFetchMeta['errors'] = []
    const legacy: import('@/lib/liquidity/types').LiquidityPosition[] = []

    evmQueries.forEach((q, i) => {
      const chainId = AGGREGATOR_EVM_CHAIN_IDS[i]!
      if (q.isError) {
        errors.push({
          chain: evmLabel(chainId),
          message: q.error instanceof Error ? q.error.message : String(q.error),
        })
        return
      }
      if (q.data) {
        legacy.push(...q.data.positions)
        if (q.data.meta.warning) warnings.push(`${evmLabel(chainId)}: ${q.data.meta.warning}`)
      }
    })

    if (solQuery.isError) {
      errors.push({
        chain: 'Solana',
        message: solQuery.error instanceof Error ? solQuery.error.message : String(solQuery.error),
      })
    } else if (solQuery.data) {
      legacy.push(...solQuery.data.positions)
      if (solQuery.data.meta.warning) warnings.push(`Solana: ${solQuery.data.meta.warning}`)
    }

    const positions: AggregatorLiquidityPosition[] = normalizePositions(legacy).sort(
      (a, b) => b.totalValueUSD - a.totalValueUSD,
    )

    const isLoadingEvm =
      evmConnected &&
      Boolean(evmAddress) &&
      evmQueries.some((q) => q.isLoading || q.isPending)
    const isLoadingSol = solConnected && Boolean(solAddress) && (solQuery.isLoading || solQuery.isPending)
    const isFetching =
      evmQueries.some((q) => q.isFetching) || solQuery.isFetching

    const hasWallet = Boolean((evmConnected && evmAddress) || (solConnected && solAddress))

    return {
      positions,
      warnings,
      errors,
      isLoading: hasWallet && (isLoadingEvm || isLoadingSol),
      isFetching,
      hasWallet,
      refetch: () => {
        evmQueries.forEach((q) => void q.refetch())
        void solQuery.refetch()
      },
    }
  }, [evmQueries, solQuery, evmConnected, evmAddress, solConnected, solAddress])

  return aggregated
}
