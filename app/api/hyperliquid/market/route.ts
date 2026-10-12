import { fetchHyperliquidMarket } from '@/lib/hyperliquid/hl-public'
import type { HlSymbol, HlTimeframe } from '@/lib/hyperliquid/types'
import { NextResponse } from 'next/server'

const SYMBOLS = new Set<HlSymbol>(['BTC', 'ETH', 'SOL', 'HYPE'])
const INTERVALS = new Set<HlTimeframe>(['15m', '1h', '4h', '1d'])

/** Leitura pública. Não envia ordens nem usa chave. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const symbol = url.searchParams.get('symbol') as HlSymbol | null
  const interval = (url.searchParams.get('interval') ?? '1h') as HlTimeframe
  if (!symbol || !SYMBOLS.has(symbol) || !INTERVALS.has(interval)) {
    return NextResponse.json({ error: 'Símbolo ou período inválido.' }, { status: 400 })
  }
  try {
    const market = await fetchHyperliquidMarket(symbol, interval)
    if (market.bars.length < 30) {
      return NextResponse.json({ error: 'Poucas velas devolvidas pela Hyperliquid.' }, { status: 502 })
    }
    return NextResponse.json(market)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Falha ao ler a Hyperliquid.' },
      { status: 502 },
    )
  }
}
