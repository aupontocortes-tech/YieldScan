import { NextRequest, NextResponse } from 'next/server'
import { getCoingeckoRequestParts } from '@/lib/coingecko-server'

const CMC_MAP = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map'
const CMC_LISTINGS = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest'
const CMC_QUOTES = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest'

type Row = {
  id?: number
  name?: string
  symbol?: string
}

type CoinOut = { id: number; symbol: string; name: string }

/** Top moedas (ids CMC estáveis) quando não há chave API — pesquisa vazia ainda mostra opções. */
const FALLBACK_TOP: CoinOut[] = [
  { id: 1, symbol: 'BTC', name: 'Bitcoin' },
  { id: 1027, symbol: 'ETH', name: 'Ethereum' },
  { id: 825, symbol: 'USDT', name: 'Tether USDt' },
  { id: 1839, symbol: 'BNB', name: 'BNB' },
  { id: 5426, symbol: 'SOL', name: 'Solana' },
  { id: 52, symbol: 'XRP', name: 'XRP' },
  { id: 3408, symbol: 'USDC', name: 'USDC' },
  { id: 2010, symbol: 'ADA', name: 'Cardano' },
  { id: 74, symbol: 'DOGE', name: 'Dogecoin' },
  { id: 1958, symbol: 'TRX', name: 'TRON' },
  { id: 5805, symbol: 'AVAX', name: 'Avalanche' },
  { id: 6636, symbol: 'DOT', name: 'Polkadot' },
  { id: 1975, symbol: 'LINK', name: 'Chainlink' },
  { id: 3890, symbol: 'MATIC', name: 'Polygon' },
  { id: 2280, symbol: 'FIL', name: 'Filecoin' },
  { id: 5994, symbol: 'SHIB', name: 'Shiba Inu' },
  { id: 4943, symbol: 'DAI', name: 'Dai' },
  { id: 7083, symbol: 'UNI', name: 'Uniswap' },
  { id: 8916, symbol: 'ICP', name: 'Internet Computer' },
  { id: 3717, symbol: 'WBTC', name: 'Wrapped Bitcoin' },
]

function matchScore(sym: string, name: string, q: string): number | null {
  if (!q) return 0
  if (sym === q) return 0
  if (sym.startsWith(q)) return 1
  if (name.startsWith(q)) return 2
  if (sym.includes(q)) return 3
  if (name.includes(q)) return 4
  return null
}

async function loadActiveCoins(apiKey: string): Promise<Row[] | null> {
  const mapRes = await fetch(
    `${CMC_MAP}?listing_status=active&sort=cmc_rank&limit=5000`,
    {
      headers: { 'X-CMC_PRO_API_KEY': apiKey },
      cache: 'no-store',
    },
  )
  if (mapRes.ok) {
    const body = (await mapRes.json()) as { data?: Row[] }
    const d = body.data
    if (Array.isArray(d) && d.length > 0) return d
  }

  const listRes = await fetch(`${CMC_LISTINGS}?start=1&limit=3000&convert=USD`, {
    headers: { 'X-CMC_PRO_API_KEY': apiKey },
    cache: 'no-store',
  })
  if (!listRes.ok) return null
  const body = (await listRes.json()) as { data?: Row[] }
  const d = body.data
  return Array.isArray(d) ? d : null
}

async function quoteOne(apiKey: string, symUpper: string): Promise<CoinOut | null> {
  const res = await fetch(
    `${CMC_QUOTES}?symbol=${encodeURIComponent(symUpper)}&convert=USD`,
    {
      headers: { 'X-CMC_PRO_API_KEY': apiKey },
      cache: 'no-store',
    },
  )
  if (!res.ok) return null
  const body = (await res.json()) as {
    data?: Record<string, { id?: number; name?: string; symbol?: string }>
  }
  const entry = body.data?.[symUpper]
  const id = Number(entry?.id) || 0
  const name = String(entry?.name ?? '').trim()
  const symbol = String(entry?.symbol ?? '').toUpperCase()
  if (id > 0 && symbol) return { id, symbol, name: name || symbol }
  return null
}

async function quoteMany(
  apiKey: string,
  symbols: string[],
): Promise<Map<string, { id: number; name: string; symbol: string }>> {
  const out = new Map<string, { id: number; name: string; symbol: string }>()
  if (!symbols.length) return out
  const res = await fetch(
    `${CMC_QUOTES}?symbol=${encodeURIComponent(symbols.join(','))}&convert=USD`,
    {
      headers: { 'X-CMC_PRO_API_KEY': apiKey },
      cache: 'no-store',
    },
  )
  if (!res.ok) return out
  const body = (await res.json()) as {
    data?: Record<string, { id?: number; name?: string; symbol?: string }>
  }
  const data = body.data ?? {}
  for (const sym of symbols) {
    const entry = data[sym]
    const id = Number(entry?.id) || 0
    if (id <= 0) continue
    out.set(sym, {
      id,
      name: String(entry?.name ?? sym).trim() || sym,
      symbol: String(entry?.symbol ?? sym).toUpperCase(),
    })
  }
  return out
}

async function searchCoingecko(q: string): Promise<{ symbol: string; name: string }[]> {
  if (q.length < 2) return []
  const { base, headers } = getCoingeckoRequestParts()
  const url = `${base}/search?query=${encodeURIComponent(q.slice(0, 64))}`
  try {
    const res = await fetch(url, { headers, cache: 'no-store' })
    if (!res.ok) return []
    const data = (await res.json()) as {
      coins?: Array<{ name?: string; symbol?: string }>
    }
    const raw = Array.isArray(data.coins) ? data.coins : []
    const out: { symbol: string; name: string }[] = []
    for (const c of raw.slice(0, 28)) {
      const symbol = String(c.symbol ?? '')
        .toUpperCase()
        .trim()
      const name = String(c.name ?? '').trim()
      if (!symbol || !/^[A-Z0-9]{2,15}$/.test(symbol)) continue
      out.push({ symbol, name: name || symbol })
    }
    return out
  } catch {
    return []
  }
}

function filterDirectory(list: Row[], q: string, take: number): CoinOut[] {
  if (q.length < 1) {
    return list
      .slice(0, 60)
      .map((c) => ({
        id: Number(c.id) || 0,
        symbol: String(c.symbol ?? '').toUpperCase(),
        name: String(c.name ?? '').trim(),
      }))
      .filter((c) => c.id > 0 && c.symbol)
  }

  type Scored = { row: Row; score: number; idx: number }
  const scored: Scored[] = []
  for (let idx = 0; idx < list.length; idx++) {
    const c = list[idx]
    const sym = String(c.symbol ?? '').toLowerCase()
    const name = String(c.name ?? '').toLowerCase()
    if (!sym && !name) continue
    const score = matchScore(sym, name, q)
    if (score !== null) scored.push({ row: c, score, idx })
  }
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    return a.idx - b.idx
  })
  return scored
    .slice(0, take)
    .map((s) => ({
      id: Number(s.row.id) || 0,
      symbol: String(s.row.symbol ?? '').toUpperCase(),
      name: String(s.row.name ?? '').trim(),
    }))
    .filter((c) => c.id > 0 && c.symbol)
}

function filterFallbackTop(q: string): CoinOut[] {
  if (!q) return [...FALLBACK_TOP]
  const qq = q.toLowerCase()
  return FALLBACK_TOP.filter(
    (c) =>
      c.symbol.toLowerCase().includes(qq) ||
      c.name.toLowerCase().includes(qq) ||
      c.symbol.toLowerCase().startsWith(qq),
  )
}

export const dynamic = 'force-dynamic'

/**
 * Autocomplete: diretório CMC (map → listings) + quotes; sem CMC, CoinGecko + quotes se houver chave;
 * sem rede, lista fixa de topo.
 */
export async function GET(req: NextRequest) {
  const rawQ = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const q = rawQ.toLowerCase()

  const apiKey =
    process.env.COINMARKETCAP_API_KEY?.trim() || process.env.CMC_PRO_API_KEY?.trim()

  if (apiKey) {
    const list = await loadActiveCoins(apiKey)
    if (list && list.length > 0) {
      let coins = filterDirectory(list, q, 50)
      const symUpper = rawQ.toUpperCase()
      const tickerLike = /^[A-Za-z0-9]{2,15}$/.test(rawQ)
      const hasExact = coins.some((c) => c.symbol === symUpper)

      if (tickerLike && !hasExact) {
        const quoted = await quoteOne(apiKey, symUpper)
        if (quoted) {
          coins = [quoted, ...coins.filter((c) => c.id !== quoted.id)]
        }
      }
      return NextResponse.json({ coins })
    }

    if (tickerLike) {
      const quoted = await quoteOne(apiKey, rawQ.toUpperCase())
      if (quoted) return NextResponse.json({ coins: [quoted] })
    }
  }

  if (rawQ.length >= 2) {
    const cg = await searchCoingecko(rawQ)
    if (cg.length && apiKey) {
      const symbols = [...new Set(cg.map((c) => c.symbol))].slice(0, 24)
      const quoted = await quoteMany(apiKey, symbols)
      const coins: CoinOut[] = []
      for (const row of cg) {
        const qd = quoted.get(row.symbol)
        if (qd) {
          coins.push({
            id: qd.id,
            symbol: qd.symbol,
            name: qd.name || row.name,
          })
        }
      }
      if (coins.length > 0) return NextResponse.json({ coins })
    }
    if (cg.length) {
      return NextResponse.json({
        coins: cg.slice(0, 20).map((c) => ({
          id: 0,
          symbol: c.symbol,
          name: c.name,
        })),
      })
    }
  }

  if (q.length < 1) {
    return NextResponse.json({ coins: [...FALLBACK_TOP] })
  }

  const local = filterFallbackTop(q)
  if (local.length > 0) {
    return NextResponse.json({ coins: local })
  }

  if (!apiKey) {
    return NextResponse.json(
      { coins: [], error: 'server_missing_cmc_key' },
      { status: 503 },
    )
  }

  return NextResponse.json({ coins: [], error: 'cmc_unavailable' }, { status: 502 })
}
