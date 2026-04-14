'use client'

import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { useWallet } from '@solana/wallet-adapter-react'
import { AGGREGATOR_EVM_CHAIN_IDS } from '@/services/constants'
import { normalizePositions } from '@/services/normalize'
import { fetchUniswapPositions } from '@/services/evm/getUniswapPositions'
import { fetchUniswapV4Positions } from '@/services/evm/getUniswapV4Positions'
import { fetchSolanaLiquidityPositions } from '@/services/solana/getSolanaPositions'
import { isValidEvmWalletAddress, normalizeSolanaAddressInput } from '@/lib/wallet-address'
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
  const solRaw = publicKey?.toBase58() ?? null
  const solAddress = solRaw ? normalizeSolanaAddressInput(solRaw) : null

  const evmEnabled = Boolean(
    evmConnected && evmAddress && isValidEvmWalletAddress(evmAddress),
  )
  const solEnabled = Boolean(solConnected && publicKey && solAddress)

  const evmQueries = useQueries({
    queries: AGGREGATOR_EVM_CHAIN_IDS.map((chainId) => ({
      queryKey: ['aggregator', 'uniswap-v3', chainId, evmAddress],
      queryFn: () => fetchUniswapPositions(evmAddress!, chainId),
      enabled: evmEnabled,
      staleTime: STALE_MS,
      gcTime: 10 * 60_000,
      refetchInterval: REFETCH_MS,
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  })

  const v4Queries = useQueries({
    queries: AGGREGATOR_EVM_CHAIN_IDS.map((chainId) => ({
      queryKey: ['aggregator', 'uniswap-v4', chainId, evmAddress],
      queryFn: () => fetchUniswapV4Positions(evmAddress!, chainId),
      enabled: evmEnabled,
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
    enabled: solEnabled,
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
      if (!evmEnabled) return
      if (q.isError) {
        errors.push({
          chain: `${evmLabel(chainId)} · v3`,
          message: q.error instanceof Error ? q.error.message : String(q.error),
        })
        return
      }
      if (q.data) {
        legacy.push(...q.data.positions)
        if (q.data.meta.warning) warnings.push(`${evmLabel(chainId)} v3: ${q.data.meta.warning}`)
      }
    })

    v4Queries.forEach((q, i) => {
      const chainId = AGGREGATOR_EVM_CHAIN_IDS[i]!
      if (!evmEnabled) return
      if (q.isError) {
        errors.push({
          chain: `${evmLabel(chainId)} · v4`,
          message: q.error instanceof Error ? q.error.message : String(q.error),
        })
        return
      }
      if (q.data) {
        legacy.push(...q.data.positions)
        if (q.data.meta.warning) warnings.push(`${evmLabel(chainId)} v4: ${q.data.meta.warning}`)
      }
    })

    if (solEnabled) {
      if (solQuery.isError) {
        errors.push({
          chain: 'Solana',
          message: solQuery.error instanceof Error ? solQuery.error.message : String(solQuery.error),
        })
      } else if (solQuery.data) {
        legacy.push(...solQuery.data.positions)
        if (solQuery.data.meta.warning) warnings.push(`Solana: ${solQuery.data.meta.warning}`)
      }
    }

    const positions: AggregatorLiquidityPosition[] = normalizePositions(legacy).sort(
      (a, b) => b.totalValueUSD - a.totalValueUSD,
    )

    const isLoadingEvm =
      evmEnabled &&
      (evmQueries.some((q) => q.isLoading || q.isPending) ||
        v4Queries.some((q) => q.isLoading || q.isPending))
    const isLoadingSol = solEnabled && (solQuery.isLoading || solQuery.isPending)
    const isFetching =
      (evmEnabled &&
        (evmQueries.some((q) => q.isFetching) || v4Queries.some((q) => q.isFetching))) ||
      (solEnabled && solQuery.isFetching)

    const hasWallet = Boolean(evmEnabled || solEnabled)

    return {
      positions,
      warnings,
      errors,
      isLoading: hasWallet && (isLoadingEvm || isLoadingSol),
      isFetching,
      hasWallet,
      refetch: () => {
        evmQueries.forEach((q) => void q.refetch())
        v4Queries.forEach((q) => void q.refetch())
        void solQuery.refetch()
      },
    }
  }, [
    evmQueries,
    v4Queries,
    solQuery,
    evmConnected,
    evmAddress,
    evmEnabled,
    solConnected,
    solAddress,
    solEnabled,
  ])

  return aggregated
}
