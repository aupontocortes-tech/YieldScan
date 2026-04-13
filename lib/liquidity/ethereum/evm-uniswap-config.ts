import {
  type SupportedEvmUniswapChainId,
  isSupportedEvmUniswapChainId,
} from '@/lib/liquidity/ethereum/evm-chain-meta'

export {
  SUPPORTED_EVM_UNISWAP_CHAIN_IDS,
  type SupportedEvmUniswapChainId,
  isSupportedEvmUniswapChainId,
  liquidityChainForUniswapEvm,
} from '@/lib/liquidity/ethereum/evm-chain-meta'

/** Endereços canónicos Uniswap v3 na maioria das redes; BNB usa contratos próprios. */
export const CANONICAL_V3_POSITION_MANAGER = '0xC36442b4a4522E871399CD017aD59865a842ddfB'
export const CANONICAL_V3_FACTORY = '0x1F9840a85d5aF5bf1D1762F925BDADd4201F984'

export type EvmUniswapChainConfig = {
  chainId: SupportedEvmUniswapChainId
  shortLabel: string
  positionManager: string
  factory: string
  coingeckoPlatform: string
  dexscreenerPath: string
  npmDeployBlock: number
  wrappedNativeLower: string
  rpcUrl: () => string
}

function pickRpc(envKeys: string[], fallback: string): string {
  for (const k of envKeys) {
    const v = process.env[k]?.trim()
    if (v) return v
  }
  return fallback
}

const CONFIGS: Record<SupportedEvmUniswapChainId, EvmUniswapChainConfig> = {
  1: {
    chainId: 1,
    shortLabel: 'ETH',
    positionManager: CANONICAL_V3_POSITION_MANAGER,
    factory: CANONICAL_V3_FACTORY,
    coingeckoPlatform: 'ethereum',
    dexscreenerPath: 'ethereum',
    npmDeployBlock: 12_369_621,
    wrappedNativeLower: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    rpcUrl: () =>
      pickRpc(['ETH_RPC_URL', 'NEXT_PUBLIC_ETH_RPC_URL'], 'https://ethereum.publicnode.com'),
  },
  42161: {
    chainId: 42161,
    shortLabel: 'Arbitrum',
    positionManager: CANONICAL_V3_POSITION_MANAGER,
    factory: CANONICAL_V3_FACTORY,
    coingeckoPlatform: 'arbitrum-one',
    dexscreenerPath: 'arbitrum',
    npmDeployBlock: 173,
    wrappedNativeLower: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    rpcUrl: () =>
      pickRpc(
        ['ARBITRUM_RPC_URL', 'NEXT_PUBLIC_ARBITRUM_RPC_URL'],
        'https://arbitrum-one.publicnode.com',
      ),
  },
  8453: {
    chainId: 8453,
    shortLabel: 'Base',
    positionManager: CANONICAL_V3_POSITION_MANAGER,
    factory: CANONICAL_V3_FACTORY,
    coingeckoPlatform: 'base',
    dexscreenerPath: 'base',
    npmDeployBlock: 5022,
    wrappedNativeLower: '0x4200000000000000000000000000000000000006',
    rpcUrl: () =>
      pickRpc(['BASE_RPC_URL', 'NEXT_PUBLIC_BASE_RPC_URL'], 'https://base.publicnode.com'),
  },
  137: {
    chainId: 137,
    shortLabel: 'Polygon',
    positionManager: CANONICAL_V3_POSITION_MANAGER,
    factory: CANONICAL_V3_FACTORY,
    coingeckoPlatform: 'polygon-pos',
    dexscreenerPath: 'polygon',
    npmDeployBlock: 22_757_547,
    wrappedNativeLower: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    rpcUrl: () =>
      pickRpc(
        ['POLYGON_RPC_URL', 'NEXT_PUBLIC_POLYGON_RPC_URL'],
        'https://polygon-bor.publicnode.com',
      ),
  },
  56: {
    chainId: 56,
    shortLabel: 'BNB',
    /** BNB Chain — endereços oficiais Uniswap v3 (≠ Ethereum). */
    positionManager: '0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613',
    factory: '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7',
    coingeckoPlatform: 'binance-smart-chain',
    dexscreenerPath: 'bsc',
    npmDeployBlock: 26_324_045,
    wrappedNativeLower: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    rpcUrl: () =>
      pickRpc(
        ['BSC_RPC_URL', 'BNB_RPC_URL', 'NEXT_PUBLIC_BSC_RPC_URL'],
        'https://bsc.publicnode.com',
      ),
  },
}

export function getEvmUniswapConfig(chainId: number): EvmUniswapChainConfig | null {
  if (!isSupportedEvmUniswapChainId(chainId)) return null
  return CONFIGS[chainId]
}
