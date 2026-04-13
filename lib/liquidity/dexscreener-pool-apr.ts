import type { LiquidityChain } from '@/lib/liquidity/types'

const DEXSCREENER_CHAIN: Record<LiquidityChain, string> = {
  ethereum: 'ethereum',
  arbitrum: 'arbitrum',
  base: 'base',
  polygon: 'polygon',
  bnb: 'bsc',
  solana: 'solana',
}

/**
 * Estimativa de APR anual da pool via DexScreener (volume 24h × fee tier / TVL × 365).
 * Aproximação; fees reais em Uniswap v3 dependem do range e da liquidez activa.
 */
export async function estimateAprFromDexscreenerPool(opts: {
  chain: LiquidityChain
  poolAddress: string
  feeTierBps: number
}): Promise<number | undefined> {
  const { chain, poolAddress, feeTierBps } = opts
  const addr = poolAddress.trim().toLowerCase()
  if (!addr) return undefined
  const chainPath = DEXSCREENER_CHAIN[chain]
  const url = `https://api.dexscreener.com/latest/dex/pairs/${chainPath}/${addr}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return undefined
    const data = (await res.json()) as {
      pairs?: Array<{ volume?: { h24?: number }; liquidity?: { usd?: number } }>
    }
    const pair = data.pairs?.[0]
    const vol = pair?.volume?.h24
    const liq = pair?.liquidity?.usd
    if (vol == null || liq == null || liq < 1 || vol < 0) return undefined
    const fee = feeTierBps / 1e6
    const apr = (vol * fee) / liq * 365 * 100
    if (!Number.isFinite(apr) || apr < 0) return undefined
    return Math.min(9999, apr)
  } catch {
    return undefined
  }
}
