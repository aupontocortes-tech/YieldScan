import type {
  GfCryptoHolding,
  GfDashboardStats,
  GfDebt,
  GfInvestment,
  GfPatrimonySnapshot,
  GfTransaction,
} from '@/lib/gestao-financeira/types'

export type GfCryptoPriceMap = Record<string, { usd: number; brl?: number }>

function monthStart(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function inCurrentMonth(iso: string): boolean {
  const d = new Date(iso)
  const start = monthStart()
  return d >= start
}

export function sumCashBalance(boxes: { balance: number }[]): number {
  return boxes.reduce((s, b) => s + b.balance, 0)
}

export function sumDebtsRemaining(debts: GfDebt[]): number {
  return debts
    .filter((d) => d.status !== 'paid')
    .reduce((s, d) => s + Math.max(0, d.totalAmount - d.paidAmount), 0)
}

export function sumInvestments(investments: GfInvestment[]): number {
  return investments.reduce((s, i) => s + (i.currentValue ?? i.amountInvested), 0)
}

export function sumCryptoHoldings(
  holdings: GfCryptoHolding[],
  prices: GfCryptoPriceMap,
  brlPerUsd = 5.1,
): { usd: number; brl: number } {
  let usd = 0
  for (const h of holdings) {
    const px = prices[h.coinId]?.usd ?? 0
    usd += h.quantity * px
  }
  return { usd, brl: usd * brlPerUsd }
}

export function computeMonthFlow(transactions: GfTransaction[]): {
  income: number
  expense: number
  savings: number
} {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (!inCurrentMonth(t.occurredAt)) continue
    if (t.type === 'income') income += t.amount
    if (t.type === 'expense') expense += t.amount
  }
  return { income, expense, savings: income - expense }
}

export function computeDashboardStats(input: {
  cashBoxes: { balance: number }[]
  transactions: GfTransaction[]
  debts: GfDebt[]
  investments: GfInvestment[]
  cryptoHoldings: GfCryptoHolding[]
  cryptoPrices: GfCryptoPriceMap
  brlPerUsd?: number
}): GfDashboardStats {
  const cashBalance = sumCashBalance(input.cashBoxes)
  const pendingDebts = sumDebtsRemaining(input.debts)
  const totalInvested = sumInvestments(input.investments)
  const crypto = sumCryptoHoldings(input.cryptoHoldings, input.cryptoPrices, input.brlPerUsd)
  const totalCrypto = crypto.brl
  const totalPatrimony = cashBalance + totalInvested + totalCrypto
  const netWorth = totalPatrimony - pendingDebts
  const flow = computeMonthFlow(input.transactions)

  return {
    totalPatrimony,
    netWorth,
    cashBalance,
    monthIncome: flow.income,
    monthExpense: flow.expense,
    monthSavings: flow.savings,
    pendingDebts,
    totalInvested,
    totalCrypto,
  }
}

export function buildPatrimonySnapshot(stats: GfDashboardStats): Omit<GfPatrimonySnapshot, 'id'> {
  return {
    totalAssets: stats.totalPatrimony,
    netWorth: stats.netWorth,
    cashTotal: stats.cashBalance,
    investmentsTotal: stats.totalInvested,
    cryptoTotal: stats.totalCrypto,
    debtsTotal: stats.pendingDebts,
    recordedAt: new Date().toISOString(),
  }
}

export function categoryTotals(
  transactions: GfTransaction[],
  categories: { id: string; name: string }[],
  type: 'income' | 'expense',
): { name: string; value: number }[] {
  const byId = new Map(categories.map((c) => [c.id, c.name]))
  const totals = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== type || !inCurrentMonth(t.occurredAt)) continue
    const name = t.categoryId ? (byId.get(t.categoryId) ?? 'Outros') : 'Outros'
    totals.set(name, (totals.get(name) ?? 0) + t.amount)
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export function monthlyFlowSeries(transactions: GfTransaction[], months = 6): { month: string; income: number; expense: number }[] {
  const out: { month: string; income: number; expense: number }[] = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    let income = 0
    let expense = 0
    for (const t of transactions) {
      const td = new Date(t.occurredAt)
      if (td < start || td >= end) continue
      if (t.type === 'income') income += t.amount
      if (t.type === 'expense') expense += t.amount
    }
    out.push({ month: key, income, expense })
  }
  return out
}

export function patrimonyEvolutionSeries(snapshots: GfPatrimonySnapshot[]): { date: string; netWorth: number; total: number }[] {
  return snapshots.map((s) => ({
    date: s.recordedAt.slice(0, 10),
    netWorth: s.netWorth,
    total: s.totalAssets,
  }))
}

export function debtsDueSoon(debts: GfDebt[], withinDays = 7): GfDebt[] {
  const now = Date.now()
  const limit = now + withinDays * 86_400_000
  return debts.filter((d) => {
    if (d.status === 'paid' || !d.dueDate) return false
    const due = new Date(d.dueDate).getTime()
    return due >= now - 86_400_000 && due <= limit
  })
}
