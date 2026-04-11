import { NextRequest, NextResponse } from 'next/server'

const CMC_QUOTES = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest'

type CmcDataEntry = {
  id?: number
  name?: string
  symbol?: string
  quote?: {
    USD?: {
      price?: number
      percent_change_24h?: number
      percent_change_7d?: number
    }
  }
}

function parseSymbols(raw: string): string[] {
  const parts = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  return [...new Set(parts)].slice(0, 120)
}

/**
 * Preços CoinMarketCap (servidor). Chave em COINMARKETCAP_API_KEY ou CMC_PRO_API_KEY.
 * GET /api/prices?symbols=BTC,ETH,SOL
 */
export async function GET(req: NextRequest) {
  const symbols = parseSymbols(req.nextUrl.searchParams.get('symbols') ?? '')
  if (!symbols.length) {
    return NextResponse.json({ prices: {}, error: 'missing_symbols' }, { status: 400 })
  }

  const apiKey =
    process.env.COINMARKETCAP_API_KEY?.trim() || process.env.CMC_PRO_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { prices: {}, error: 'server_missing_cmc_key' },
      { status: 503 },
    )
  }

  const url = `${CMC_QUOTES}?symbol=${encodeURIComponent(symbols.join(','))}&convert=USD`
  try {
    const res = await fetch(url, {
      headers: { 'X-CMC_PRO_API_KEY': apiKey },
      cache: 'no-store',
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json(
        { prices: {}, error: `cmc_${res.status}`, detail: text.slice(0, 200) },
        { status: res.status === 429 ? 429 : 502 },
      )
    }
    const body = (await res.json()) as {
      data?: Record<string, CmcDataEntry>
      status?: { error_message?: string }
    }
    const data = body.data ?? {}
    const prices: Record<
      string,
      {
        price: number
        pct24h: number
        pct7d: number
        name: string
        cmcId: number
      }
    > = {}

    for (const sym of symbols) {
      const entry = data[sym]
      if (!entry?.quote?.USD) continue
      const usd = entry.quote.USD
      prices[sym] = {
        price: Number(usd.price) || 0,
        pct24h: Number(usd.percent_change_24h) || 0,
        pct7d: Number(usd.percent_change_7d) || 0,
        name: String(entry.name ?? sym),
        cmcId: Number(entry.id) || 0,
      }
    }

    return NextResponse.json({ prices })
  } catch {
    return NextResponse.json({ prices: {}, error: 'network' }, { status: 502 })
  }
}
