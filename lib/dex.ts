/** Corretoras / infra de negociação descentralizada — links oficiais e contexto (PT-BR). */
export interface DexPlatform {
  id: string
  name: string
  description: string
  chains: string
  href: string
  /** Fragmento do `project` na API yields.llama.fi para filtrar em Pools (opcional). */
  poolFilterHint?: string
}

export const DEX_PLATFORMS: DexPlatform[] = [
  {
    id: 'meteora',
    name: 'Meteora',
    description:
      'DEX na Solana: DLMM, pools dinâmicas e liquidez programável (incl. estáveis).',
    chains: 'Solana',
    href: 'https://app.meteora.ag',
    poolFilterHint: 'meteora',
  },
  {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    description:
      'L1 focado em perpétuos e order book on-chain; spot e HIP-3 com baixa latência.',
    chains: 'Hyperliquid L1',
    href: 'https://app.hyperliquid.xyz',
    poolFilterHint: 'hyperliquid',
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    description: 'Agregador de liquidez e swap na Solana; roteamento entre vários AMMs.',
    chains: 'Solana',
    href: 'https://jup.ag',
    poolFilterHint: 'jupiter',
  },
  {
    id: 'raydium',
    name: 'Raydium',
    description: 'AMM clássico e concentrado na Solana; integração com order book Serum/OpenBook.',
    chains: 'Solana',
    href: 'https://raydium.io',
    poolFilterHint: 'raydium',
  },
  {
    id: 'orca',
    name: 'Orca',
    description: 'AMM na Solana com Whirlpools (concentração de liquidez) e forte UX.',
    chains: 'Solana',
    href: 'https://www.orca.so',
    poolFilterHint: 'orca',
  },
  {
    id: 'drift',
    name: 'Drift',
    description: 'Perpétuos, spot e borrow na Solana com order book híbrido.',
    chains: 'Solana',
    href: 'https://app.drift.trade',
    poolFilterHint: 'drift',
  },
  {
    id: 'uniswap',
    name: 'Uniswap',
    description: 'AMM líder em Ethereum e L2s; v2, v3 e v4 com liquidez concentrada.',
    chains: 'Ethereum, Arbitrum, Base, Optimism, …',
    href: 'https://app.uniswap.org',
    poolFilterHint: 'uniswap',
  },
  {
    id: 'curve',
    name: 'Curve',
    description: 'Pools estáveis e meta-pools; forte em stablecoins e yields de baixo slippage.',
    chains: 'Multichain',
    href: 'https://www.curve.finance',
    poolFilterHint: 'curve',
  },
  {
    id: 'gmx',
    name: 'GMX',
    description: 'Perpétuos e spot com pool de liquidez GLP / GM em Arbitrum e Avalanche.',
    chains: 'Arbitrum, Avalanche',
    href: 'https://app.gmx.io',
    poolFilterHint: 'gmx',
  },
  {
    id: 'dydx',
    name: 'dYdX',
    description: 'Exchange de perpétuos na dYdX Chain com matching de alto débito.',
    chains: 'dYdX Chain',
    href: 'https://dydx.trade',
    poolFilterHint: 'dydx',
  },
  {
    id: 'vertex',
    name: 'Vertex',
    description: 'Order book híbrido multichain; spot e perpétuos com margem unificada.',
    chains: 'Arbitrum, outros',
    href: 'https://app.vertexprotocol.com',
    poolFilterHint: 'vertex',
  },
  {
    id: 'aerodrome',
    name: 'Aerodrome',
    description: 'DEX principal na Base; fork do modelo Velodrome (ve(3,3)).',
    chains: 'Base',
    href: 'https://aerodrome.finance',
    poolFilterHint: 'aerodrome',
  },
  {
    id: 'velodrome',
    name: 'Velodrome',
    description: 'Liquidez ve(3,3) na Optimism e expansão para outras redes.',
    chains: 'Optimism, …',
    href: 'https://velodrome.finance',
    poolFilterHint: 'velodrome',
  },
]
