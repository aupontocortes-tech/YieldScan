import type { Pool } from './types'
import { canonicalLlamaChain } from './llama-chain'

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

/** Endereço / id Solana (base58), sem 0x. */
function isSolanaStylePoolId(id: string): boolean {
  const t = id.trim()
  if (!t || /^0x/i.test(t)) return false
  return /^[1-9A-HJ-NP-Za-km-z]{32,48}$/.test(t)
}

/** Uniswap Explore: slug da rede a partir do `chain` da pool (DefiLlama). */
function uniswapExploreSlugFromChain(chain: string): string | null {
  const c = canonicalLlamaChain(chain).toLowerCase().replace(/\s+/g, '')
  const map: Record<string, string> = {
    ethereum: 'ethereum',
    arbitrum: 'arbitrum',
    base: 'base',
    optimism: 'optimism',
    polygon: 'polygon',
    bsc: 'bnb',
    avalanche: 'avalanche',
    celo: 'celo',
    blast: 'blast',
    zksyncera: 'zksync',
    unichain: 'unichain',
    worldchain: 'worldchain',
    'worldchain-mainnet': 'worldchain',
  }
  return map[c] ?? null
}

/** Pools yields Llama cujo `project` é Uniswap (não Sushi/Pancake “uniswap fork” no nome). */
function isUniswapPoolProject(project: string): boolean {
  const p = project.toLowerCase()
  if (!p.includes('uniswap')) return false
  if (p.includes('sushiswap') || p.includes('pancakeswap') || p.includes('biswap')) return false
  return true
}

/**
 * `pool.url` que só aponta para o app genérico (home / swap). A API às vezes manda isso em vez da pool;
 * nesses casos precisamos ignorar e montar `/explore/pools/...`.
 */
function isUniswapGenericAppUrl(url: string): boolean {
  const lower = url.toLowerCase()
  if (!lower.includes('uniswap.org')) return false
  if (lower.includes('/explore/pools/')) return false
  if (lower.includes('#/pool') || lower.includes('#/add') || lower.includes('#/positions')) return false
  if (
    lower.includes('currencya=') ||
    lower.includes('currency_a') ||
    lower.includes('feeamount') ||
    lower.includes('pool_id=') ||
    lower.includes('pool=')
  ) {
    return false
  }
  try {
    const { pathname } = new URL(url)
    const p = (pathname || '/').toLowerCase()
    if (p === '/' || p === '' || p.startsWith('/swap')) return true
    if (p.startsWith('/explore') && !p.startsWith('/explore/pools/')) return true
    return false
  } catch {
    return true
  }
}

/**
 * Monta URL da pool quando `pool.url` falta (API incompleta ou campo vazio) — espelha os adaptadores DefiLlama.
 */
function buildPoolDeepLinkFromId(
  pool: Pick<Pool, 'project' | 'pool' | 'chain' | 'poolMeta'>
): string | null {
  const proj = (pool.project ?? '').toLowerCase()
  const pid = (pool.pool ?? '').trim()
  if (!pid) return null

  if (proj.includes('orca') && isSolanaStylePoolId(pid)) {
    return `https://www.orca.so/pools/${pid}`
  }

  if (proj.includes('raydium') && isSolanaStylePoolId(pid)) {
    const meta = (pool.poolMeta ?? '').toLowerCase()
    const isClmm = meta.includes('concentrated')
    return isClmm
      ? `https://raydium.io/clmm/create-position/?pool_id=${pid}`
      : `https://raydium.io/liquidity/increase/?mode=add&pool_id=${pid}`
  }

  if (pid.startsWith('meteora-dlmm-')) {
    const addr = pid.slice('meteora-dlmm-'.length)
    if (addr) return `https://app.meteora.ag/dlmm/${addr}`
  }

  if (proj.includes('uniswap-v4')) {
    const m = pid.match(/^(0x[a-fA-F0-9]+)-([a-z0-9]+)-uniswap-v4$/i)
    if (m) {
      const [, addr, chainHint] = m
      const slug =
        chainHint.toLowerCase() === 'avax'
          ? 'avalanche'
          : chainHint.toLowerCase() === 'bsc'
            ? 'bnb'
            : chainHint.toLowerCase()
      return `https://app.uniswap.org/explore/pools/${slug}/${addr}`
    }
  }

  if (isUniswapPoolProject(proj) && !proj.includes('uniswap-v4')) {
    if (/^0x[a-fA-F0-9]{40}$/i.test(pid)) {
      const slug = uniswapExploreSlugFromChain(pool.chain)
      if (slug) return `https://app.uniswap.org/explore/pools/${slug}/${pid}`
    }
  }

  return null
}

/** Slug em `pool.project` (DefiLlama) → site oficial quando não há `pool.url`. */
const DEX_FALLBACK_HREFS: { hint: string; href: string }[] = [
  { hint: 'balancer', href: 'https://app.balancer.fi' },
  { hint: 'sushi', href: 'https://www.sushi.com' },
  { hint: 'pancakeswap', href: 'https://pancakeswap.finance' },
  { hint: 'camelot', href: 'https://app.camelot.exchange' },
  { hint: 'trader-joe', href: 'https://traderjoexyz.com' },
  { hint: 'quickswap', href: 'https://quickswap.exchange' },
  { hint: 'kamino', href: 'https://app.kamino.finance' },
]

/**
 * Link direto para a pool na corretora (`pool.url` DefiLlama), depois heurísticas por `pool`+`project`,
 * e por fim a página oficial da DEX.
 */
export function resolvePoolOrDexUrl(
  pool: Pick<Pool, 'url' | 'project' | 'pool' | 'chain' | 'poolMeta'>
): string | null {
  const proj = (pool.project ?? '').toLowerCase()
  const raw = pool.url?.trim()
  const deep = buildPoolDeepLinkFromId(pool)

  if (raw?.startsWith('/') && proj.includes('orca')) {
    return `https://www.orca.so${raw}`
  }

  if (raw && /^https?:\/\//i.test(raw)) {
    if (isUniswapPoolProject(proj) && isUniswapGenericAppUrl(raw)) {
      if (deep) return deep
      return raw
    }
    return raw
  }

  if (deep) return deep

  for (const d of DEX_PLATFORMS) {
    const hint = d.poolFilterHint
    if (hint && proj.includes(hint)) return d.href
  }
  for (const { hint, href } of DEX_FALLBACK_HREFS) {
    if (proj.includes(hint)) return href
  }
  return null
}
