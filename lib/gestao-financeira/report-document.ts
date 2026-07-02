import {
  categoryTotals,
  filterTransactionsByRange,
  sumCashBalance,
  sumCryptoHoldings,
  sumDebtsRemaining,
  type GfCryptoPriceMap,
} from '@/lib/gestao-financeira/calculations'
import type {
  GfCashBox,
  GfCategory,
  GfCryptoHolding,
  GfDateRange,
  GfDebt,
  GfPeriodSummary,
  GfTransaction,
} from '@/lib/gestao-financeira/types'

export type GfEpigraphicReport = {
  generatedAt: string
  periodLabel: string
  period: GfPeriodSummary
  patrimony: {
    cashBalance: number
    totalCrypto: number
    totalInvested: number
    pendingDebts: number
    totalPatrimony: number
    netWorth: number
  }
  cashBoxes: { name: string; balance: number }[]
  expenseByCategory: { name: string; value: number }[]
  incomeByCategory: { name: string; value: number }[]
  cryptoHoldings: { symbol: string; quantity: number; valueBrl: number }[]
  debts: { name: string; remaining: number; dueDate: string | null }[]
  transactions: {
    date: string
    type: 'income' | 'expense' | 'transfer'
    amount: number
    category: string
    description: string
    cashBox: string
  }[]
}

export function buildGfEpigraphicReport(input: {
  periodLabel: string
  period: GfPeriodSummary
  reportRange: GfDateRange
  transactions: GfTransaction[]
  categories: GfCategory[]
  cashBoxes: GfCashBox[]
  cryptoHoldings: GfCryptoHolding[]
  cryptoPrices: GfCryptoPriceMap
  debts: GfDebt[]
  investments: { currentValue: number | null; amountInvested: number }[]
  brlPerUsd: number
}): GfEpigraphicReport {
  const cashBalance = sumCashBalance(input.cashBoxes)
  const crypto = sumCryptoHoldings(input.cryptoHoldings, input.cryptoPrices, input.brlPerUsd)
  const totalInvested = input.investments.reduce(
    (s, i) => s + (i.currentValue ?? i.amountInvested),
    0,
  )
  const pendingDebts = sumDebtsRemaining(input.debts)
  const totalPatrimony = cashBalance + totalInvested + crypto.brl
  const netWorth = totalPatrimony - pendingDebts

  const periodTx = filterTransactionsByRange(input.transactions, input.reportRange)
  const catMap = new Map(input.categories.map((c) => [c.id, c.name]))
  const boxMap = new Map(input.cashBoxes.map((b) => [b.id, b.name]))

  return {
    generatedAt: new Date().toISOString(),
    periodLabel: input.periodLabel,
    period: input.period,
    patrimony: {
      cashBalance,
      totalCrypto: crypto.brl,
      totalInvested,
      pendingDebts,
      totalPatrimony,
      netWorth,
    },
    cashBoxes: input.cashBoxes.map((b) => ({ name: b.name, balance: b.balance })),
    expenseByCategory: categoryTotals(input.transactions, input.categories, 'expense', input.reportRange).slice(
      0,
      8,
    ),
    incomeByCategory: categoryTotals(input.transactions, input.categories, 'income', input.reportRange).slice(0, 8),
    cryptoHoldings: input.cryptoHoldings.map((h) => {
      const px = input.cryptoPrices[h.coinId]?.brl ?? input.cryptoPrices[h.coinId]?.usd ?? 0
      const valueBrl =
        input.cryptoPrices[h.coinId]?.brl != null
          ? h.quantity * input.cryptoPrices[h.coinId]!.brl!
          : h.quantity * px * input.brlPerUsd
      return { symbol: h.symbol, quantity: h.quantity, valueBrl }
    }),
    debts: input.debts
      .filter((d) => d.status !== 'paid')
      .map((d) => ({
        name: d.name,
        remaining: Math.max(0, d.totalAmount - d.paidAmount),
        dueDate: d.dueDate,
      })),
    transactions: periodTx
      .slice()
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .map((t) => ({
        date: t.occurredAt.slice(0, 10),
        type: t.type,
        amount: t.amount,
        category: t.categoryId ? (catMap.get(t.categoryId) ?? 'Outros') : '—',
        description: t.description ?? '',
        cashBox: boxMap.get(t.cashBoxId) ?? '—',
      })),
  }
}

function fmtBrlHtml(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function txTypeLabel(type: GfEpigraphicReport['transactions'][0]['type']): string {
  if (type === 'income') return 'Receita'
  if (type === 'expense') return 'Despesa'
  return 'Transferência'
}

/** HTML autocontido para imprimir ou guardar como PDF no browser. */
export function renderGfReportHtml(report: GfEpigraphicReport): string {
  const generated = new Date(report.generatedAt).toLocaleString('pt-BR')

  const categoryRows = (items: { name: string; value: number }[]) =>
    items.length
      ? items
          .map(
            (c) =>
              `<tr><td>${escapeHtml(c.name)}</td><td class="num">${fmtBrlHtml(c.value)}</td></tr>`,
          )
          .join('')
      : '<tr><td colspan="2" class="muted">Sem registos</td></tr>'

  const txRows = report.transactions.length
    ? report.transactions
        .map(
          (t) =>
            `<tr>
              <td>${t.date}</td>
              <td>${txTypeLabel(t.type)}</td>
              <td>${escapeHtml(t.description || t.category)}</td>
              <td>${escapeHtml(t.category)}</td>
              <td class="num">${fmtBrlHtml(t.amount)}</td>
            </tr>`,
        )
        .join('')
    : '<tr><td colspan="5" class="muted">Sem movimentações no período</td></tr>'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório — ${escapeHtml(report.periodLabel)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #111; margin: 0; padding: 24px; line-height: 1.45; }
    h1 { font-size: 1.35rem; margin: 0 0 4px; }
    h2 { font-size: 0.95rem; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .meta { color: #555; font-size: 0.85rem; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 8px; }
    .card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 10px 12px; }
    .card .label { font-size: 0.72rem; color: #666; text-transform: uppercase; letter-spacing: 0.03em; }
    .card .value { font-size: 1.05rem; font-weight: 700; margin-top: 2px; }
    .positive { color: #047857; }
    .negative { color: #b91c1c; }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    th, td { border-bottom: 1px solid #eee; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { font-size: 0.72rem; text-transform: uppercase; color: #666; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .muted { color: #888; font-style: italic; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>YieldScan — Gestão Financeira</h1>
  <p class="meta">Período: <strong>${escapeHtml(report.periodLabel)}</strong> · Gerado em ${generated}</p>

  <h2>Resumo do período</h2>
  <div class="grid">
    <div class="card"><div class="label">Receitas</div><div class="value positive">${fmtBrlHtml(report.period.income)}</div></div>
    <div class="card"><div class="label">Despesas</div><div class="value negative">${fmtBrlHtml(report.period.expense)}</div></div>
    <div class="card"><div class="label">Economia</div><div class="value ${report.period.savings >= 0 ? 'positive' : 'negative'}">${fmtBrlHtml(report.period.savings)}</div></div>
    <div class="card"><div class="label">Movimentações</div><div class="value">${report.period.transactionCount}</div></div>
  </div>

  <h2>Património actual</h2>
  <div class="grid">
    <div class="card"><div class="label">Caixa</div><div class="value">${fmtBrlHtml(report.patrimony.cashBalance)}</div></div>
    <div class="card"><div class="label">Cripto</div><div class="value">${fmtBrlHtml(report.patrimony.totalCrypto)}</div></div>
    <div class="card"><div class="label">Investimentos</div><div class="value">${fmtBrlHtml(report.patrimony.totalInvested)}</div></div>
    <div class="card"><div class="label">Dívidas pendentes</div><div class="value negative">${fmtBrlHtml(report.patrimony.pendingDebts)}</div></div>
    <div class="card"><div class="label">Património total</div><div class="value">${fmtBrlHtml(report.patrimony.totalPatrimony)}</div></div>
    <div class="card"><div class="label">Património líquido</div><div class="value">${fmtBrlHtml(report.patrimony.netWorth)}</div></div>
  </div>

  <h2>Caixas</h2>
  <table><thead><tr><th>Caixa</th><th class="num">Saldo</th></tr></thead><tbody>
    ${report.cashBoxes.map((b) => `<tr><td>${escapeHtml(b.name)}</td><td class="num">${fmtBrlHtml(b.balance)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Sem caixas</td></tr>'}
  </tbody></table>

  <h2>Despesas por categoria</h2>
  <table><thead><tr><th>Categoria</th><th class="num">Valor</th></tr></thead><tbody>${categoryRows(report.expenseByCategory)}</tbody></table>

  <h2>Receitas por categoria</h2>
  <table><thead><tr><th>Categoria</th><th class="num">Valor</th></tr></thead><tbody>${categoryRows(report.incomeByCategory)}</tbody></table>

  ${
    report.cryptoHoldings.length
      ? `<h2>Cripto</h2><table><thead><tr><th>Ativo</th><th class="num">Qtd</th><th class="num">Valor (BRL)</th></tr></thead><tbody>${report.cryptoHoldings
          .map(
            (h) =>
              `<tr><td>${escapeHtml(h.symbol)}</td><td class="num">${h.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}</td><td class="num">${fmtBrlHtml(h.valueBrl)}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : ''
  }

  ${
    report.debts.length
      ? `<h2>Dívidas</h2><table><thead><tr><th>Nome</th><th>Vencimento</th><th class="num">Restante</th></tr></thead><tbody>${report.debts
          .map(
            (d) =>
              `<tr><td>${escapeHtml(d.name)}</td><td>${d.dueDate?.slice(0, 10) ?? '—'}</td><td class="num">${fmtBrlHtml(d.remaining)}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : ''
  }

  <h2>Movimentações do período</h2>
  <table>
    <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th></tr></thead>
    <tbody>${txRows}</tbody>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
