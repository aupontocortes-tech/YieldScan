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

function parseIds(raw: string): number[] {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const ids = [...new Set(parts.map((p) => Number(p)).filter((n) => Number.isFinite(n) && n > 0))]
  return ids.slice(0, 120)
}

/**
 * Preços CoinMarketCap (servidor). Chave em COINMARKETCAP_API_KEY ou CMC_PRO_API_KEY.
 * GET /api/prices?symbols=BTC,ETH,SOL
 * GET /api/prices?ids=1,1027 — cotação por id CMC (evita ambiguidade de símbolo); resposta inclui `byCmcId`.
 */
export async function GET(req: NextRequest) {
  const ids = parseIds(req.nextUrl.searchParams.get('ids') ?? '')
  const symbols = parseSymbols(req.nextUrl.searchParams.get('symbols') ?? '')
  if (!symbols.length && !ids.length) {
    return NextResponse.json({ prices: {}, error: 'missing_symbols_or_ids' }, { status: 400 })
  }

  const apiKey =
    process.env.COINMARKETCAP_API_KEY?.trim() || process.env.CMC_PRO_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { prices: {}, error: 'server_missing_cmc_key' },
      { status: 503 },
    )
  }

  const url = ids.length
    ? `${CMC_QUOTES}?id=${encodeURIComponent(ids.join(','))}&convert=USD`
    : `${CMC_QUOTES}?symbol=${encodeURIComponent(symbols.join(','))}&convert=USD`
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
    const byCmcId: Record<
      string,
      {
        price: number
        pct24h: number
        pct7d: number
        name: string
        cmcId: number
      }
    > = {}

    if (ids.length) {
      for (const [idKey, entry] of Object.entries(data)) {
        if (!entry?.quote?.USD) continue
        const usd = entry.quote.USD
        const sym = String(entry.symbol ?? '').toUpperCase()
        const cmcId = Number(entry.id) || Number(idKey) || 0
        const row = {
          price: Number(usd.price) || 0,
          pct24h: Number(usd.percent_change_24h) || 0,
          pct7d: Number(usd.percent_change_7d) || 0,
          name: String(entry.name ?? (sym || idKey)),
          cmcId,
        }
        byCmcId[idKey] = row
        if (sym) prices[sym] = row
      }
      return NextResponse.json({ prices, byCmcId })
    }

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
