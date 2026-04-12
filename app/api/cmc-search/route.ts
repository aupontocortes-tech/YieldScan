import { NextRequest, NextResponse } from 'next/server'
import { getCoingeckoRequestParts } from '@/lib/coingecko-server'

type CoinSearchRow = {
  /** Id interno CoinGecko (ex.: bitcoin). */
  id: string
  symbol: string
  name: string
  iconUrl?: string
}

/** Top moedas quando a pesquisa está vazia (ids CoinGecko). */
const FALLBACK_TOP: CoinSearchRow[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    iconUrl: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    iconUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  {
    id: 'tether',
    symbol: 'USDT',
    name: 'Tether',
    iconUrl: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  },
  {
    id: 'binancecoin',
    symbol: 'BNB',
    name: 'BNB',
    iconUrl: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  },
  {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    iconUrl: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  },
  {
    id: 'ripple',
    symbol: 'XRP',
    name: 'XRP',
    iconUrl: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  },
  {
    id: 'usd-coin',
    symbol: 'USDC',
    name: 'USDC',
    iconUrl: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  },
  {
    id: 'cardano',
    symbol: 'ADA',
    name: 'Cardano',
    iconUrl: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
  },
  {
    id: 'dogecoin',
    symbol: 'DOGE',
    name: 'Dogecoin',
    iconUrl: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  },
  {
    id: 'tron',
    symbol: 'TRX',
    name: 'TRON',
    iconUrl: 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png',
  },
  {
    id: 'avalanche-2',
    symbol: 'AVAX',
    name: 'Avalanche',
    iconUrl: 'https://assets.coingecko.com/coins/images/12559/small/coin-round-red.png',
  },
  {
    id: 'polkadot',
    symbol: 'DOT',
    name: 'Polkadot',
    iconUrl: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
  },
  {
    id: 'chainlink',
    symbol: 'LINK',
    name: 'Chainlink',
    iconUrl: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  },
  {
    id: 'matic-network',
    symbol: 'MATIC',
    name: 'Polygon',
    iconUrl: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  },
  {
    id: 'filecoin',
    symbol: 'FIL',
    name: 'Filecoin',
    iconUrl: 'https://assets.coingecko.com/coins/images/12817/small/filecoin.png',
  },
  {
    id: 'shiba-inu',
    symbol: 'SHIB',
    name: 'Shiba Inu',
    iconUrl: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
  },
  {
    id: 'dai',
    symbol: 'DAI',
    name: 'Dai',
    iconUrl: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',
  },
  {
    id: 'uniswap',
    symbol: 'UNI',
    name: 'Uniswap',
    iconUrl: 'https://assets.coingecko.com/coins/images/12504/small/uniswap.png',
  },
  {
    id: 'internet-computer',
    symbol: 'ICP',
    name: 'Internet Computer',
    iconUrl: 'https://assets.coingecko.com/coins/images/14495/small/internet-computer.png',
  },
  {
    id: 'wrapped-bitcoin',
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    iconUrl: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  },
]

function filterFallbackTop(q: string): CoinSearchRow[] {
  if (!q) return [...FALLBACK_TOP]
  const qq = q.toLowerCase()
  return FALLBACK_TOP.filter(
    (c) =>
      c.symbol.toLowerCase().includes(qq) ||
      c.name.toLowerCase().includes(qq) ||
      c.symbol.toLowerCase().startsWith(qq) ||
      c.id.includes(qq),
  )
}

async function searchCoingecko(q: string): Promise<CoinSearchRow[]> {
  if (q.length < 2) return []
  const { base, headers } = getCoingeckoRequestParts()
  const url = `${base}/search?query=${encodeURIComponent(q.slice(0, 64))}`
  try {
    const res = await fetch(url, { headers, cache: 'no-store' })
    if (!res.ok) return []
    const data = (await res.json()) as {
      coins?: Array<{
        id?: string
        name?: string
        symbol?: string
        thumb?: string
        large?: string
      }>
    }
    const raw = Array.isArray(data.coins) ? data.coins : []
    const out: CoinSearchRow[] = []
    for (const c of raw.slice(0, 28)) {
      const id = String(c.id ?? '')
        .trim()
        .toLowerCase()
      const symbol = String(c.symbol ?? '')
        .toUpperCase()
        .trim()
      const name = String(c.name ?? '').trim()
      if (!id || !symbol || !/^[A-Z0-9]{2,15}$/.test(symbol)) continue
      const thumb = String(c.thumb ?? c.large ?? '').trim()
      const iconUrl = /^https?:\/\//i.test(thumb) ? thumb : undefined
      out.push({ id, symbol, name: name || symbol, iconUrl })
    }
    return out
  } catch {
    return []
  }
}

export const dynamic = 'force-dynamic'

/**
 * Autocomplete da carteira via CoinGecko (GET /search). Sem chave usa API pública.
 */
export async function GET(req: NextRequest) {
  const rawQ = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const q = rawQ.toLowerCase()

  if (!rawQ.length) {
    return NextResponse.json({ coins: [...FALLBACK_TOP] })
  }

  if (rawQ.length < 2) {
    const local = filterFallbackTop(q)
    return NextResponse.json({ coins: local })
  }

  const coins = await searchCoingecko(rawQ)
  if (coins.length > 0) {
    return NextResponse.json({ coins })
  }

  const local = filterFallbackTop(q)
  if (local.length > 0) {
    return NextResponse.json({ coins: local })
  }

  return NextResponse.json({ coins: [], error: 'coingecko_empty' })
}
