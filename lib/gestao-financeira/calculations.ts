import { canonicalHighlightCoinGeckoId } from '@/lib/mercado-highlight-ids'
import { resolveExpenseCategoryName } from '@/lib/gestao-financeira/category-hints'
import type {
  GfCryptoHolding,
  GfCryptoWallet,
  GfDashboardStats,
  GfDateRange,
  GfDebt,
  GfInvestment,
  GfPatrimonySnapshot,
  GfPeriodPreset,
  GfPeriodSummary,
  GfTransaction,
} from '@/lib/gestao-financeira/types'

export type GfCryptoPriceMap = Record<string, { usd: number; brl?: number }>

/** USD por moeda — preço ao vivo ou preço médio registado. */
export function gfHoldingPriceUsd(holding: GfCryptoHolding, prices: GfCryptoPriceMap): number {
  const live = prices[holding.coinId]?.usd
  if (live != null && live > 0) return live
  if (holding.avgPriceUsd > 0) return holding.avgPriceUsd
  return 0
}

export function gfHoldingValueUsd(holding: GfCryptoHolding, prices: GfCryptoPriceMap): number {
  return holding.quantity * gfHoldingPriceUsd(holding, prices)
}

export function gfHoldingValueBrl(
  holding: GfCryptoHolding,
  prices: GfCryptoPriceMap,
  brlPerUsd = 5.1,
): number {
  const brlLive = prices[holding.coinId]?.brl
  if (brlLive != null && brlLive > 0) return holding.quantity * brlLive
  const fx = Number.isFinite(brlPerUsd) && brlPerUsd > 0 ? brlPerUsd : 5.1
  return gfHoldingValueUsd(holding, prices) * fx
}

const DAY_MS = 86_400_000

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function isInRange(iso: string, range: GfDateRange): boolean {
  const d = new Date(iso)
  return d >= range.start && d < range.end
}

export function getDayRange(ref = new Date()): GfDateRange {
  const start = startOfDay(ref)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

export function getWeekRange(ref = new Date()): GfDateRange {
  const d = startOfDay(ref)
  const diffToMonday = (d.getDay() + 6) % 7
  const start = new Date(d)
  start.setDate(start.getDate() - diffToMonday)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end }
}

export function getMonthRange(ref = new Date()): GfDateRange {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1)
  return { start, end }
}

export function getQuarterRange(ref = new Date()): GfDateRange {
  const q = Math.floor(ref.getMonth() / 3)
  const start = new Date(ref.getFullYear(), q * 3, 1)
  const end = new Date(ref.getFullYear(), q * 3 + 3, 1)
  return { start, end }
}

export function getCustomRange(fromYmd: string, toYmd: string): GfDateRange {
  let start = startOfDay(new Date(`${fromYmd}T12:00:00`))
  let endInclusive = startOfDay(new Date(`${toYmd}T12:00:00`))
  if (endInclusive < start) {
    const tmp = start
    start = endInclusive
    endInclusive = tmp
  }
  const end = new Date(endInclusive)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

export function resolvePeriodRange(
  preset: GfPeriodPreset,
  anchor: Date,
  custom?: { from: string; to: string },
): GfDateRange {
  switch (preset) {
    case 'day':
      return getDayRange(anchor)
    case 'week':
      return getWeekRange(anchor)
    case 'month':
      return getMonthRange(anchor)
    case 'quarter':
      return getQuarterRange(anchor)
    case 'custom':
      return getCustomRange(custom?.from ?? toYmd(anchor), custom?.to ?? toYmd(anchor))
  }
}

export function shiftPeriodAnchor(preset: GfPeriodPreset, anchor: Date, delta: -1 | 1): Date {
  const d = new Date(anchor)
  if (preset === 'day') {
    d.setDate(d.getDate() + delta)
    return d
  }
  if (preset === 'week') {
    d.setDate(d.getDate() + delta * 7)
    return d
  }
  if (preset === 'month') {
    d.setMonth(d.getMonth() + delta)
    return d
  }
  if (preset === 'quarter') {
    d.setMonth(d.getMonth() + delta * 3)
    return d
  }
  return d
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const PT_MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function formatPeriodLabel(preset: GfPeriodPreset, range: GfDateRange): string {
  const lastInclusive = new Date(range.end.getTime() - DAY_MS)
  if (preset === 'day') {
    return range.start.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }
  if (preset === 'week') {
    const a = range.start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    const b = lastInclusive.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    return `${a} – ${b}`
  }
  if (preset === 'month') {
    const m = PT_MONTHS[range.start.getMonth()]
    return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${range.start.getFullYear()}`
  }
  if (preset === 'quarter') {
    const q = Math.floor(range.start.getMonth() / 3) + 1
    return `${q}º trimestre ${range.start.getFullYear()}`
  }
  const a = range.start.toLocaleDateString('pt-BR')
  const b = lastInclusive.toLocaleDateString('pt-BR')
  return `${a} – ${b}`
}

export function filterTransactionsByRange(transactions: GfTransaction[], range: GfDateRange): GfTransaction[] {
  return transactions.filter((t) => isInRange(t.occurredAt, range))
}

export function computePeriodFlow(
  transactions: GfTransaction[],
  range: GfDateRange,
): Pick<GfPeriodSummary, 'income' | 'expense' | 'savings' | 'transactionCount'> {
  let income = 0
  let expense = 0
  let transactionCount = 0
  for (const t of transactions) {
    if (!isInRange(t.occurredAt, range)) continue
    transactionCount++
    if (t.type === 'income') income += t.amount
    if (t.type === 'expense') expense += t.amount
  }
  return { income, expense, savings: income - expense, transactionCount }
}

export function buildPeriodSummary(
  transactions: GfTransaction[],
  preset: GfPeriodPreset,
  range: GfDateRange,
): GfPeriodSummary {
  const flow = computePeriodFlow(transactions, range)
  return {
    ...flow,
    label: formatPeriodLabel(preset, range),
  }
}

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

function cryptoHoldingDedupeKey(h: GfCryptoHolding): string {
  const sym = h.symbol.trim().toUpperCase()
  if (sym) return `sym:${sym}`
  const coin = canonicalHighlightCoinGeckoId(h.coinId)
  if (coin) return `coin:${coin}`
  return h.id
}

/** Evita contar duas vezes a mesma moeda (ex.: Hold manual + espelho da Carteira). */
export function dedupeGfCryptoHoldingsForStats(
  holdings: GfCryptoHolding[],
  wallets: Pick<GfCryptoWallet, 'id' | 'walletType'>[],
): GfCryptoHolding[] {
  const portfolioIds = new Set(
    wallets.filter((w) => w.walletType === 'portfolio').map((w) => w.id),
  )
  const best = new Map<string, GfCryptoHolding>()
  for (const h of holdings) {
    const key = cryptoHoldingDedupeKey(h)
    const prev = best.get(key)
    if (!prev) {
      best.set(key, h)
      continue
    }
    const hPortfolio = portfolioIds.has(h.walletId)
    const prevPortfolio = portfolioIds.has(prev.walletId)
    if (hPortfolio && !prevPortfolio) best.set(key, h)
  }
  return [...best.values()]
}

export function sumCryptoHoldings(
  holdings: GfCryptoHolding[],
  prices: GfCryptoPriceMap,
  brlPerUsd = 5.1,
): { usd: number; brl: number } {
  let usd = 0
  let brl = 0
  for (const h of holdings) {
    usd += gfHoldingValueUsd(h, prices)
    brl += gfHoldingValueBrl(h, prices, brlPerUsd)
  }
  return { usd, brl }
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
  cryptoWallets?: Pick<GfCryptoWallet, 'id' | 'walletType'>[]
  cryptoPrices: GfCryptoPriceMap
  brlPerUsd?: number
}): GfDashboardStats {
  const cashBalance = sumCashBalance(input.cashBoxes)
  const pendingDebts = sumDebtsRemaining(input.debts)
  const totalInvested = sumInvestments(input.investments)
  const holdingsForStats =
    input.cryptoWallets && input.cryptoWallets.length > 0
      ? dedupeGfCryptoHoldingsForStats(input.cryptoHoldings, input.cryptoWallets)
      : input.cryptoHoldings
  const crypto = sumCryptoHoldings(holdingsForStats, input.cryptoPrices, input.brlPerUsd)
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
  range?: GfDateRange,
): { name: string; value: number; count: number }[] {
  const totals = new Map<string, { value: number; count: number }>()
  for (const t of transactions) {
    if (t.type !== type) continue
    if (range ? !isInRange(t.occurredAt, range) : !inCurrentMonth(t.occurredAt)) continue
    const name =
      type === 'expense'
        ? resolveExpenseCategoryName(t, categories)
        : t.categoryId
          ? (categories.find((c) => c.id === t.categoryId)?.name ?? 'Outros')
          : resolveExpenseCategoryName(t, categories)
    const prev = totals.get(name) ?? { value: 0, count: 0 }
    prev.value += t.amount
    prev.count += 1
    totals.set(name, prev)
  }
  return [...totals.entries()]
    .map(([name, { value, count }]) => ({ name, value, count }))
    .sort((a, b) => b.value - a.value)
}

/** Série temporal dentro de um intervalo (dia / semana / mês conforme duração). */
export function flowSeriesForRange(
  transactions: GfTransaction[],
  range: GfDateRange,
): { label: string; income: number; expense: number }[] {
  const spanDays = Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / DAY_MS))
  const bucket: 'day' | 'week' | 'month' = spanDays <= 31 ? 'day' : spanDays <= 120 ? 'week' : 'month'

  const buckets = new Map<string, { income: number; expense: number; sort: number }>()

  const bucketKey = (d: Date): { key: string; sort: number } => {
    if (bucket === 'day') {
      return { key: toYmd(d), sort: d.getTime() }
    }
    if (bucket === 'week') {
      const w = getWeekRange(d)
      return { key: formatPeriodLabel('week', w), sort: w.start.getTime() }
    }
    const m = getMonthRange(d)
    const key = `${m.start.getFullYear()}-${String(m.start.getMonth() + 1).padStart(2, '0')}`
    return { key, sort: m.start.getTime() }
  }

  for (const t of transactions) {
    if (!isInRange(t.occurredAt, range)) continue
    const d = new Date(t.occurredAt)
    const { key, sort } = bucketKey(d)
    const row = buckets.get(key) ?? { income: 0, expense: 0, sort }
    if (t.type === 'income') row.income += t.amount
    if (t.type === 'expense') row.expense += t.amount
    buckets.set(key, row)
  }

  return [...buckets.entries()]
    .sort((a, b) => a[1].sort - b[1].sort)
    .map(([label, v]) => ({ label, income: v.income, expense: v.expense }))
}

export function filterSnapshotsByRange(snapshots: GfPatrimonySnapshot[], range: GfDateRange): GfPatrimonySnapshot[] {
  return snapshots.filter((s) => isInRange(s.recordedAt, range))
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
