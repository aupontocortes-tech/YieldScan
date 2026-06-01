/**
 * Ações americanas (EUA) — watchlists, mapeamento xStock (CoinGecko) e helpers.
 */

export type UsEquitySectorTag = 'indice' | 'ia' | 'semis' | 'big-tech' | 'outro'

export const US_EQUITY_XSTOCK_SUFFIX = '-xstock'

/** Slugs CoinGecko (tokenizados) para destaques no Mercado. */
export const US_STOCK_XSTOCK_IDS = [
  'nasdaq-xstock',
  'sp500-xstock',
  'nvidia-xstock',
  'microsoft-xstock',
  'alphabet-xstock',
  'meta-xstock',
  'amazon-xstock',
  'tesla-xstock',
  'microstrategy-xstock',
] as const

/** Destaques mistos sugeridos para novos utilizadores (cripto + ações). */
export const DEFAULT_MARKET_HIGHLIGHT_MIX = [
  'bitcoin',
  'ethereum',
  'solana',
  'nvidia-xstock',
  'nasdaq-xstock',
  'microsoft-xstock',
] as const

/** Tickers FMP — IA, semis e big tech (EUA). */
export const US_AI_TECH_TICKERS = [
  'NVDA',
  'MSFT',
  'GOOGL',
  'META',
  'AMZN',
  'AAPL',
  'AMD',
  'AVGO',
  'TSM',
  'INTC',
  'MU',
  'QCOM',
  'ARM',
  'SMCI',
  'PLTR',
  'CRM',
  'ORCL',
  'ADBE',
  'NFLX',
  'COIN',
  'MSTR',
] as const

export const TICKER_TO_XSTOCK: Record<string, string> = {
  NVDA: 'nvidia-xstock',
  MSFT: 'microsoft-xstock',
  GOOGL: 'alphabet-xstock',
  GOOG: 'alphabet-xstock',
  META: 'meta-xstock',
  AMZN: 'amazon-xstock',
  TSLA: 'tesla-xstock',
  MSTR: 'microstrategy-xstock',
}

const SEMIS = new Set(['NVDA', 'AMD', 'AVGO', 'INTC', 'MU', 'QCOM', 'ARM', 'SMCI', 'TSM'])
const BIG_TECH = new Set([
  'MSFT',
  'GOOGL',
  'GOOG',
  'META',
  'AMZN',
  'AAPL',
  'NFLX',
  'ADBE',
  'CRM',
  'ORCL',
])
const IA_EXTRA = new Set(['PLTR', 'COIN', 'MSTR', 'NVDA'])

export function isUsEquityXstock(id: string): boolean {
  const k = id.trim().toLowerCase()
  return k.endsWith(US_EQUITY_XSTOCK_SUFFIX) || (US_STOCK_XSTOCK_IDS as readonly string[]).includes(k)
}

export function equitySectorTag(symbol: string): UsEquitySectorTag {
  const t = symbol.toUpperCase()
  if (['QQQ', 'SPY', 'NDX', 'DIA', 'IWM'].includes(t)) return 'indice'
  if (t === 'NVDA' || IA_EXTRA.has(t)) return 'ia'
  if (SEMIS.has(t)) return 'semis'
  if (BIG_TECH.has(t)) return 'big-tech'
  return 'outro'
}

export function equityDisplayName(symbol: string, apiName?: string | null): string {
  if (apiName?.trim()) return apiName.trim()
  const names: Record<string, string> = {
    NVDA: 'NVIDIA',
    MSFT: 'Microsoft',
    GOOGL: 'Alphabet (Google)',
    META: 'Meta',
    AMZN: 'Amazon',
    AAPL: 'Apple',
    AMD: 'AMD',
    AVGO: 'Broadcom',
    TSLA: 'Tesla',
    MSTR: 'MicroStrategy',
    COIN: 'Coinbase',
    PLTR: 'Palantir',
    INTC: 'Intel',
    TSM: 'TSMC',
    SMCI: 'Super Micro',
  }
  return names[symbol.toUpperCase()] ?? symbol.toUpperCase()
}

export function xstockIdForTicker(symbol: string): string | null {
  return TICKER_TO_XSTOCK[symbol.toUpperCase()] ?? null
}
