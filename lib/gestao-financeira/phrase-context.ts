import type { useGestaoFinanceira } from '@/hooks/use-gestao-financeira'
import type { GfPhraseRouteContext } from '@/lib/gestao-financeira/phrase-router'

export function buildGfPhraseContext(gf: ReturnType<typeof useGestaoFinanceira>): GfPhraseRouteContext {
  const cashBoxes = gf.cashBoxes.map((b) => ({ name: b.name, balance: b.balance }))
  const totalCashBrl = cashBoxes.reduce((s, b) => s + b.balance, 0)

  const cryptoHoldings = gf.cryptoHoldings.map((h) => {
    const price = gf.cryptoPrices[h.coinId]?.brl ?? 0
    return { symbol: h.symbol, quantity: h.quantity, valueBrl: h.quantity * price }
  })
  const totalCryptoBrl = cryptoHoldings.reduce((s, h) => s + h.valueBrl, 0)

  return {
    todayIso: new Date().toISOString(),
    cashBoxes,
    cryptoHoldings,
    categories: gf.categories.map((c) => c.name),
    totalCashBrl,
    totalCryptoBrl,
    existingTodos: gf.todos,
    transactions: gf.transactions,
    monthIncome: gf.stats?.monthIncome ?? 0,
    monthExpense: gf.stats?.monthExpense ?? 0,
    monthSavings: gf.stats?.monthSavings ?? 0,
  }
}
