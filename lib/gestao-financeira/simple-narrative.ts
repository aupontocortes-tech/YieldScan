import { categoryTotals } from '@/lib/gestao-financeira/calculations'
import { groupGfTodos } from '@/lib/gestao-financeira/todos-utils'
import type { GfDashboardStats, GfTodo, GfTransaction } from '@/lib/gestao-financeira/types'

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export type GfSimpleNarrative = {
  headline: string
  paragraphs: string[]
  fullText: string
  chartHint: string | null
  savingsTone: 'good' | 'warn' | 'neutral'
}

export function buildGfSimpleNarrative(input: {
  stats: GfDashboardStats
  insights: string[]
  todos: GfTodo[]
  transactions: GfTransaction[]
  categories: { id: string; name: string }[]
}): GfSimpleNarrative {
  const { stats, insights, todos, transactions, categories } = input
  const paragraphs: string[] = []

  paragraphs.push(
    `O seu patrimônio total é de ${fmtBrl(stats.totalPatrimony)}. Em caixa você tem ${fmtBrl(stats.cashBalance)}.`,
  )

  if (stats.totalCrypto > 0) {
    paragraphs.push(`Em criptomoedas você tem cerca de ${fmtBrl(stats.totalCrypto)}.`)
  }

  if (stats.monthIncome > 0 || stats.monthExpense > 0) {
    let monthLine = `Este mês você recebeu ${fmtBrl(stats.monthIncome)} e gastou ${fmtBrl(stats.monthExpense)}.`
    if (stats.monthSavings > 0) {
      monthLine += ` Sobrou ${fmtBrl(stats.monthSavings)} — ótimo!`
    } else if (stats.monthExpense > stats.monthIncome && stats.monthIncome > 0) {
      monthLine += ` As despesas passaram das receitas — vale olhar com calma onde o dinheiro foi.`
    }
    paragraphs.push(monthLine)
  }

  const expenses = categoryTotals(transactions, categories, 'expense')
  const topExpense = expenses[0]
  let chartHint: string | null = null
  if (topExpense && stats.monthExpense > 0) {
    const pct = Math.round((topExpense.value / stats.monthExpense) * 100)
    chartHint = `A maior fatia dos gastos foi «${topExpense.name}»: ${fmtBrl(topExpense.value)} (${pct}% do mês).`
    paragraphs.push(chartHint)
  }

  const groups = groupGfTodos(todos)
  const overdue = groups.find((g) => g.key === 'overdue')?.items ?? []
  const today = groups.find((g) => g.key === 'today')?.items ?? []
  const pendingToday = [...overdue, ...today]

  if (pendingToday.length > 0) {
    const titles = pendingToday.slice(0, 4).map((t) => t.title)
    const rest = pendingToday.length - titles.length
    let todoLine = `Nos afazeres, `
    if (overdue.length > 0) {
      todoLine += `você tem ${overdue.length} atrasado${overdue.length > 1 ? 's' : ''}`
      if (today.length > 0) todoLine += ` e ${today.length} para hoje`
    } else {
      todoLine += `hoje você tem ${today.length} tarefa${today.length > 1 ? 's' : ''}`
    }
    todoLine += `: ${titles.join(', ')}`
    if (rest > 0) todoLine += ` e mais ${rest}.`
    else todoLine += '.'
    paragraphs.push(todoLine)
  } else {
    paragraphs.push('Nos afazeres, não há nada urgente para hoje. Um bom momento para organizar a semana.')
  }

  if (insights[0]) {
    paragraphs.push(insights[0]!)
  }

  const savingsTone: GfSimpleNarrative['savingsTone'] =
    stats.monthSavings > 0 ? 'good' : stats.monthExpense > stats.monthIncome && stats.monthIncome > 0 ? 'warn' : 'neutral'

  const headline =
    savingsTone === 'good'
      ? 'Suas finanças estão no caminho certo este mês.'
      : savingsTone === 'warn'
        ? 'Atenção: gastou mais do que recebeu este mês.'
        : 'Aqui está o resumo simples das suas finanças.'

  return {
    headline,
    paragraphs,
    fullText: [headline, ...paragraphs].join(' '),
    chartHint,
    savingsTone,
  }
}
