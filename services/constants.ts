/** Cadeias EVM do agregador (Uniswap v3) — alinhado ao produto multichain. */
export const AGGREGATOR_EVM_CHAIN_IDS = [1, 42_161, 137, 8453] as const

export type AggregatorEvmChainId = (typeof AGGREGATOR_EVM_CHAIN_IDS)[number]
