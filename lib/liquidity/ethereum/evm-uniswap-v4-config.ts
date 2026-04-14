import type { SupportedEvmUniswapChainId } from '@/lib/liquidity/ethereum/evm-chain-meta'

/**
 * Contratos oficiais Uniswap v4 (PositionManager + StateView).
 * Fonte: https://docs.uniswap.org/contracts/v4/deployments
 */
export type EvmUniswapV4ChainConfig = {
  chainId: SupportedEvmUniswapChainId
  /** Nonfungible Position Manager (ERC-721) */
  positionManager: `0x${string}`
  /** Lens para ler slot0 / liquidez do pool sem extsload manual */
  stateView: `0x${string}`
  /** Bloco aproximado do deploy — limita início do scan de Transfer */
  pmDeployBlock: number
}

/** Mesmas redes que o agregador v3; endereços distintos por chain. */
export const EVM_UNISWAP_V4_BY_CHAIN: Partial<Record<SupportedEvmUniswapChainId, EvmUniswapV4ChainConfig>> = {
  1: {
    chainId: 1,
    positionManager: '0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e',
    stateView: '0x7ffe42c4a5deea5b0fec41c94c136cf115597227',
    pmDeployBlock: 21_800_000,
  },
  8453: {
    chainId: 8453,
    positionManager: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
    stateView: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
    pmDeployBlock: 22_800_000,
  },
  42161: {
    chainId: 42161,
    positionManager: '0xd88f38f930b7952f2db2432cb002e7abbf3dd869',
    stateView: '0x76fd297e2d437cd7f76d50f01afe6160f86e9990',
    pmDeployBlock: 285_000_000,
  },
  137: {
    chainId: 137,
    positionManager: '0x1ec2ebf4f37e7363fdfe3551602425af0b3ceef9',
    stateView: '0x5ea1bd7974c8a611cbab0bdcafcb1d9cc9b3ba5a',
    pmDeployBlock: 63_500_000,
  },
  56: {
    chainId: 56,
    positionManager: '0x7a4a5c919ae2541aed11041a1aeee68f1287f95b',
    stateView: '0xd13dd3d6e93f276fafc9db9e6bb47c1180aee0c4',
    pmDeployBlock: 42_000_000,
  },
}

export function getEvmUniswapV4Config(chainId: number): EvmUniswapV4ChainConfig | null {
  const c = EVM_UNISWAP_V4_BY_CHAIN[chainId as SupportedEvmUniswapChainId]
  return c ?? null
}
