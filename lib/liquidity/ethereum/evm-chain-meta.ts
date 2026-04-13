import type { LiquidityChain } from '@/lib/liquidity/types'

/** Redes EVM onde o My Liquidity lê Uniswap v3 on-chain. */
export const SUPPORTED_EVM_UNISWAP_CHAIN_IDS = [1, 42161, 8453, 137, 56] as const

export type SupportedEvmUniswapChainId = (typeof SUPPORTED_EVM_UNISWAP_CHAIN_IDS)[number]

export function isSupportedEvmUniswapChainId(n: number): n is SupportedEvmUniswapChainId {
  return (SUPPORTED_EVM_UNISWAP_CHAIN_IDS as readonly number[]).includes(n)
}

export const EVM_UNISWAP_CHAIN_LABEL: Record<SupportedEvmUniswapChainId, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  8453: 'Base',
  137: 'Polygon',
  56: 'BNB Chain',
}

export function liquidityChainForUniswapEvm(chainId: SupportedEvmUniswapChainId): LiquidityChain {
  switch (chainId) {
    case 1:
      return 'ethereum'
    case 42161:
      return 'arbitrum'
    case 8453:
      return 'base'
    case 137:
      return 'polygon'
    case 56:
      return 'bnb'
  }
}
