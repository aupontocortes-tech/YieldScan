import { categoryTotals, computeMonthFlow, sumCryptoHoldings } from '@/lib/gestao-financeira/calculations'
import type { GfCryptoHolding, GfDashboardStats, GfPatrimonySnapshot, GfTransaction } from '@/lib/gestao-financeira/types'
import type { GfCryptoPriceMap } from '@/lib/gestao-financeira/calculations'

export function generateGfInsights(input: {
  stats: GfDashboardStats
  transactions: GfTransaction[]
  categories: { id: string; name: string }[]
  cryptoHoldings: GfCryptoHolding[]
  cryptoPrices: GfCryptoPriceMap
  snapshots: GfPatrimonySnapshot[]
}): string[] {
  const insights: string[] = []
  const { stats, transactions, categories, cryptoHoldings, cryptoPrices, snapshots } = input

  if (stats.monthSavings > 0) {
    insights.push(
      `Você economizou R$ ${stats.monthSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} este mês.`,
    )
  } else if (stats.monthExpense > stats.monthIncome && stats.monthIncome > 0) {
    insights.push('Suas despesas superaram as receitas este mês — revise categorias com maior gasto.')
  }

  const food = categoryTotals(transactions, categories, 'expense').find((c) =>
    /alimenta|mercado/i.test(c.name),
  )
  if (food && stats.monthExpense > 0) {
    const pct = Math.round((food.value / stats.monthExpense) * 100)
    if (pct >= 15) {
      insights.push(`Alimentação e mercado representam cerca de ${pct}% das despesas do mês.`)
    }
  }

  const crypto = sumCryptoHoldings(cryptoHoldings, cryptoPrices)
  if (crypto.brl > 0 && stats.totalPatrimony > 0) {
    const pct = Math.round((crypto.brl / stats.totalPatrimony) * 100)
    insights.push(`Criptomoedas representam ${pct}% do seu patrimônio total.`)
  }

  if (snapshots.length >= 2) {
    const first = snapshots[0]!
    const last = snapshots[snapshots.length - 1]!
    if (first.netWorth > 0) {
      const days = Math.max(
        1,
        (new Date(last.recordedAt).getTime() - new Date(first.recordedAt).getTime()) / 86_400_000,
      )
      if (days <= 35) {
        const growth = ((last.netWorth - first.netWorth) / first.netWorth) * 100
        if (Math.abs(growth) >= 1) {
          insights.push(
            `Seu patrimônio líquido ${growth >= 0 ? 'cresceu' : 'caiu'} ${Math.abs(growth).toFixed(1)}% nos últimos ${Math.round(days)} dias.`,
          )
        }
      }
    }
  }

  const prevMonth = computePrevMonthExpense(transactions)
  const cur = computeMonthFlow(transactions).expense
  if (prevMonth > 0 && cur > 0) {
    const delta = ((cur - prevMonth) / prevMonth) * 100
    if (Math.abs(delta) >= 8) {
      const cat = categoryTotals(transactions, categories, 'expense')[0]
      insights.push(
        delta > 0
          ? `Você gastou ${Math.round(delta)}% mais este mês${cat ? ` — destaque em ${cat.name}` : ''}.`
          : `Você reduziu despesas em ${Math.abs(Math.round(delta))}% em relação ao mês anterior.`,
      )
    }
  }

  if (stats.pendingDebts > 0) {
    insights.push(
      `Dívidas pendentes: R$ ${stats.pendingDebts.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
    )
  }

  return insights.slice(0, 6)
}

function computePrevMonthExpense(transactions: GfTransaction[]): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 1)
  let expense = 0
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    const d = new Date(t.occurredAt)
    if (d >= start && d < end) expense += t.amount
  }
  return expense
}
