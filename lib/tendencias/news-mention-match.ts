import {
  CRYPTO_NAME_TO_SYMBOL,
  STOCK_NAME_TO_TICKER,
} from '@/lib/tendencias/trim-config'

export type NewsMentionFilterKind = 'crypto' | 'stock'

/**
 * Verifica se a manchete menciona o ticker do filtro (símbolos extraídos + nome no título).
 * Assim o filtro “mais falados” mostra notícias reais do ativo, não só as do slice diversificado.
 */
export function headlineMatchesMentionFilter(
  h: {
    titulo: string
    symbols?: string[]
    stockSymbols?: string[]
  },
  filter: { kind: NewsMentionFilterKind; symbol: string },
): boolean {
  const sym = filter.symbol.trim().toUpperCase()
  if (!sym) return false

  if (filter.kind === 'crypto') {
    if ((h.symbols ?? []).some((s) => s.toUpperCase() === sym)) return true
    return titleMentionsCryptoSymbol(h.titulo, sym)
  }

  if ((h.stockSymbols ?? []).some((s) => s.toUpperCase() === sym)) return true
  return titleMentionsStockSymbol(h.titulo, sym)
}

function titleMentionsCryptoSymbol(title: string, sym: string): boolean {
  const t = title.trim()
  if (!t) return false
  if (new RegExp(`\\b${escapeReg(sym)}\\b`, 'i').test(t)) return true
  for (const [pattern, symbol] of CRYPTO_NAME_TO_SYMBOL) {
    if (symbol !== sym) continue
    pattern.lastIndex = 0
    if (pattern.test(t)) return true
  }
  return false
}

function titleMentionsStockSymbol(title: string, sym: string): boolean {
  const t = title.trim()
  if (!t) return false
  if (new RegExp(`\\b${escapeReg(sym)}\\b`, 'i').test(t)) return true
  for (const [pattern, ticker] of STOCK_NAME_TO_TICKER) {
    if (ticker !== sym) continue
    pattern.lastIndex = 0
    if (pattern.test(t)) return true
  }
  return false
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
