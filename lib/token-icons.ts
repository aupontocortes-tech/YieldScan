import type { Pool } from './types'
import { COINGECKO_LOGO_BY_ID, SYMBOL_LOGO_URL } from './coingecko-static-logos'
import { KNOWN_TOKEN_ADDRESSES } from './known-token-addresses'

/** Trust Wallet `blockchains/*` folder names. */
const TRUST_CHAIN: Record<string, string> = {
  Ethereum: 'ethereum',
  BSC: 'smartchain',
  Polygon: 'polygon',
  Arbitrum: 'arbitrum',
  Base: 'base',
  Optimism: 'optimism',
  Avalanche: 'avalanchec',
  Fantom: 'fantom',
  Solana: 'solana',
  Linea: 'linea',
  Scroll: 'scroll',
  Blast: 'blast',
  'zkSync Era': 'zksync',
  Celo: 'celo',
  Aurora: 'aurora',
  Cronos: 'cronos',
  Gnosis: 'xdai',
  Moonbeam: 'moonbeam',
  Moonriver: 'moonriver',
  OpBNB: 'opbnb',
  Manta: 'manta',
  Sonic: 'sonic',
  Monad: 'monad',
  Berachain: 'berachain',
  Sui: 'sui',
  Aptos: 'aptos',
  Osmosis: 'osmosis',
  Cardano: 'cardano',
  Ton: 'ton',
  Starknet: 'starknet',
  Katana: 'katana',
  Flare: 'flare',
  Fraxtal: 'fraxtal',
  Plasma: 'plasma',
  'Polygon zkEVM': 'polygonzkevm',
  Metis: 'metis',
  Boba: 'boba',
  Harmony: 'harmony',
  Kava: 'kava',
  OKTChain: 'okc',
  ZetaChain: 'zetachain',
}

/** Uniswap assets repo — pastas `blockchains/*` (BSC = `binance`). */
const UNISWAP_BLOCKCHAIN: Record<string, string> = {
  Ethereum: 'ethereum',
  Base: 'base',
  Arbitrum: 'arbitrum',
  Optimism: 'optimism',
  Polygon: 'polygon',
  BSC: 'binance',
  Fantom: 'fantom',
  Linea: 'linea',
  Scroll: 'scroll',
  zkSync: 'zksync',
  'zkSync Era': 'zksync',
  Celo: 'celo',
  Blast: 'blast',
  Gnosis: 'xdai',
  Metis: 'metis',
  Boba: 'boba',
  Moonbeam: 'moonbeam',
  Moonriver: 'moonriver',
  Cronos: 'cronos',
}

const NATIVE_SENTINELS = new Set([
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '0x0000000000000000000000000000000000000000',
])

export function normalizeTokenSymbol(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\.E$/i, '')
}

export function tokenPairParts(symbol: string): string[] {
  const raw = symbol.split(/[-/]/).map((s) => s.trim()).filter(Boolean)
  if (raw.length >= 2) return [raw[0]!, raw[1]!]
  if (raw.length === 1) return [raw[0]!]
  return [symbol.slice(0, 8) || '?']
}

export function symbolToInitials(symbol: string): string {
  const s = symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return s.slice(0, 2) || '?'
}

/** Entradas `underlyingTokens` com endereço ou `coingecko:id`. */
function parseUnderlyingTokens(pool: Pool): Array<{ address?: string; coingeckoId?: string }> {
  const out: Array<{ address?: string; coingeckoId?: string }> = []
  for (const e of pool.underlyingTokens ?? []) {
    if (out.length >= 2) break
    const t = e?.trim()
    if (!t) continue
    const cg = t.match(/^coingecko:\s*(.+)$/i)
    if (cg) {
      out.push({ coingeckoId: cg[1]!.trim().toLowerCase() })
      continue
    }
    if (pool.chain === 'Solana' && !t.startsWith('0x')) {
      out.push({ address: t })
      continue
    }
    if (t.startsWith('0x') && t.length === 42) {
      if (NATIVE_SENTINELS.has(t.toLowerCase())) continue
      out.push({ address: t })
    }
  }
  return out
}

function uniswapAssetLogoUrls(chain: string, address: string): string[] {
  const slug = UNISWAP_BLOCKCHAIN[chain]
  if (!slug || !address.startsWith('0x') || address.length !== 42) return []
  const lower = `0x${address.slice(2).toLowerCase()}`
  const base = `https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/${slug}/assets`
  return [`${base}/${lower}/logo.png`, `${base}/${address}/logo.png`]
}

/**
 * URLs públicas para logo do token (Trust, GitHub, 1inch Ethereum, Uniswap assets).
 */
export function tokenLogoCandidates(chain: string, address: string): string[] {
  const trust = TRUST_CHAIN[chain]
  const addr = address.trim()
  if (!trust || !addr) return []

  if (chain === 'Solana') {
    return [
      `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/solana/assets/${addr}/logo.png`,
      `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/${addr}/logo.png`,
    ]
  }

  if (!addr.startsWith('0x') || addr.length !== 42) return []

  const lower = `0x${addr.slice(2).toLowerCase()}`
  const variants = addr === lower ? [addr] : [addr, lower]
  const urls: string[] = []

  for (const v of variants) {
    urls.push(
      `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/${trust}/assets/${v}/logo.png`,
      `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${trust}/assets/${v}/logo.png`
    )
  }

  if (chain === 'Ethereum') {
    urls.push(`https://tokens.1inch.io/${lower}.png`)
  }

  urls.push(...uniswapAssetLogoUrls(chain, lower))

  return [...new Set(urls)]
}

/**
 * Lista ordenada de URLs para o avatar do slot (0 ou 1): API, endereço conhecido, logos por símbolo.
 */
export function buildAvatarUrlList(pool: Pool, slotIndex: 0 | 1): string[] {
  const parts = tokenPairParts(pool.symbol)
  const symRaw = (parts[slotIndex] ?? parts[0] ?? pool.symbol).trim()
  const sym = normalizeTokenSymbol(symRaw)

  const fromApi = parseUnderlyingTokens(pool)
  const api = fromApi[slotIndex]

  const urls: string[] = []

  if (api?.coingeckoId) {
    const id = api.coingeckoId.toLowerCase().replace(/\s+/g, '-')
    const byId = COINGECKO_LOGO_BY_ID[id] ?? COINGECKO_LOGO_BY_ID[api.coingeckoId]
    if (byId) urls.push(byId)
  }

  let address = api?.address
  const chainKnown = KNOWN_TOKEN_ADDRESSES[pool.chain]

  if (!address && chainKnown) {
    address = chainKnown[sym]
  }
  if (!address && slotIndex === 1 && parts[1]) {
    const s1 = normalizeTokenSymbol(parts[1])
    address = chainKnown?.[s1]
  }

  if (address) {
    urls.push(...tokenLogoCandidates(pool.chain, address))
  }

  const symLogo = SYMBOL_LOGO_URL[sym]
  if (symLogo) urls.push(symLogo)

  return [...new Set(urls)]
}

/** @deprecated use buildAvatarUrlList — mantido para imports externos */
export function pickUnderlyingTokenAddresses(pool: Pool, max = 2): string[] {
  const parsed = parseUnderlyingTokens(pool)
  const out: string[] = []
  for (const p of parsed) {
    if (p.address && out.length < max) out.push(p.address)
  }
  return out
}
