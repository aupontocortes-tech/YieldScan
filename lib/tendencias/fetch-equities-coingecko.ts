/**
 * Fallback de ações US via preços xStock (CoinGecko) quando FMP não responde.
 */
import { agregarMercadoCoinGecko, type MercadoCoin } from '@/lib/coingecko-market'
import { highlightMetaFromPresetOrId } from '@/lib/mercado-highlight-presets'
import {
  US_STOCK_XSTOCK_IDS,
  XSTOCK_ID_TO_TICKER,
  equitySectorTag,
  type UsEquitySectorTag,
} from '@/lib/us-equities'
import type { TendenciasEquityRow } from '@/lib/tendencias/types'
import type { UsEquitiesSnapshot } from '@/lib/tendencias/fetch-us-equities'

function coinToEquityRow(coin: MercadoCoin): TendenciasEquityRow {
  const id = coin.id.trim().toLowerCase()
  const symbol = XSTOCK_ID_TO_TICKER[id] ?? coin.symbol.replace(/X$/i, '').toUpperCase()
  const meta = highlightMetaFromPresetOrId(id)
  const sectorTag: UsEquitySectorTag = equitySectorTag(symbol)

  return {
    symbol,
    name: coin.name || meta.name,
    price: coin.price,
    changePct: coin.change_24h,
    volume: null,
    marketCap: coin.market_cap,
    sectorTag,
    xstockId: id,
  }
}

function sortByChange(rows: TendenciasEquityRow[]): TendenciasEquityRow[] {
  return [...rows].sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
}

function sortByCap(rows: TendenciasEquityRow[]): TendenciasEquityRow[] {
  return [...rows].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
}

export async function fetchEquitiesFromCoingecko(): Promise<UsEquitiesSnapshot | null> {
  const ids = [...US_STOCK_XSTOCK_IDS]
  try {
    const payload = await agregarMercadoCoinGecko(ids)
    const rows = payload.highlightCoins
      .filter((c): c is MercadoCoin => c != null && c.price != null)
      .map(coinToEquityRow)

    if (!rows.length) return null

    const highlights = sortByChange(rows).slice(0, 8)
    const aiWatchlist = sortByChange(
      rows.filter((r) => ['ia', 'semis', 'big-tech', 'indice'].includes(r.sectorTag)),
    ).slice(0, 12)
    const topVolume = sortByCap(rows).slice(0, 10)

    const leader = highlights[0]
    let summary = 'Ações US tokenizadas (xStock · CoinGecko). '
    if (leader?.changePct != null) {
      summary += `${leader.name} ${leader.changePct >= 0 ? '+' : ''}${leader.changePct.toFixed(2)}% (24h). `
    }
    summary += 'Cotações de referência; para volume intraday usa FMP quando configurada.'

    return { highlights, topVolume, aiWatchlist, summary }
  } catch {
    return null
  }
}
