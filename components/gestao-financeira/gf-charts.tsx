'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { GfDateRange, GfPatrimonySnapshot, GfTransaction } from '@/lib/gestao-financeira/types'
import {
  categoryTotals,
  flowSeriesForRange,
  monthlyFlowSeries,
  patrimonyEvolutionSeries,
} from '@/lib/gestao-financeira/calculations'

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pieLabel(intuitive: boolean, total: number) {
  if (!intuitive) return undefined
  return (props: { name?: string; value?: number; percent?: number }) => {
    const name = props.name ?? ''
    const value = props.value ?? 0
    const pct = props.percent != null ? Math.round(props.percent * 100) : total > 0 ? Math.round((value / total) * 100) : 0
    if (pct < 6) return ''
    return `${name}: ${pct}%`
  }
}

type Props = {
  transactions: GfTransaction[]
  categories: { id: string; name: string }[]
  snapshots: GfPatrimonySnapshot[]
  stats: {
    cashBalance: number
    totalInvested: number
    totalCrypto: number
    pendingDebts: number
  }
  cryptoBreakdown: { name: string; value: number }[]
  reportRange?: GfDateRange
  periodLabel?: string
  /** Legendas mais simples e gráficos principais em destaque. */
  intuitive?: boolean
  chartHint?: string | null
}

export function GfCharts({
  transactions,
  categories,
  snapshots,
  stats,
  cryptoBreakdown,
  reportRange,
  periodLabel,
  intuitive = false,
  chartHint,
}: Props) {
  const rangeSuffix = periodLabel ? ` (${periodLabel})` : ' (mês)'
  const expensePie = categoryTotals(transactions, categories, 'expense', reportRange)
  const incomePie = categoryTotals(transactions, categories, 'income', reportRange)
  const expenseTotal = expensePie.reduce((s, x) => s + x.value, 0)
  const flow = reportRange
    ? flowSeriesForRange(transactions, reportRange)
    : monthlyFlowSeries(transactions).map((m) => ({
        label: m.month,
        income: m.income,
        expense: m.expense,
      }))
  const patrimony = patrimonyEvolutionSeries(snapshots)

  const patrimonyPie = [
    { name: 'Caixa', value: stats.cashBalance },
    { name: 'Investimentos', value: stats.totalInvested },
    { name: 'Cripto', value: stats.totalCrypto },
  ].filter((x) => x.value > 0)

  const expenseTitle = intuitive ? 'Para onde foi o dinheiro' : `Despesas por categoria${rangeSuffix}`
  const flowTitle = intuitive
    ? reportRange
      ? `Receitas e despesas${rangeSuffix}`
      : 'Receitas e despesas (últimos 6 meses)'
    : reportRange
      ? `Receitas vs despesas${rangeSuffix}`
      : 'Receitas vs despesas (últimos 6 meses)'

  const primaryCharts = (
    <>
      <ChartCard
        title={expenseTitle}
        subtitle={intuitive ? chartHint ?? 'Cada cor é um tipo de gasto — a maior fatia pesa mais no bolso.' : undefined}
      >
        {expensePie.length ? (
          <ResponsiveContainer width="100%" height={intuitive ? 280 : 240}>
            <PieChart>
              <Pie
                data={expensePie}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={intuitive ? 95 : 80}
                label={intuitive ? pieLabel(intuitive, expenseTotal) : true}
                labelLine={intuitive}
              >
                {expensePie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, _n, item) => {
                  const pct = expenseTotal > 0 ? Math.round((v / expenseTotal) * 100) : 0
                  return intuitive ? `${fmtBrl(v)} (${pct}%)` : fmtBrl(v)
                }}
              />
              <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Ainda não há despesas neste período." />
        )}
      </ChartCard>

      <ChartCard
        title={flowTitle}
        subtitle={intuitive ? 'Barras verdes = entrou dinheiro. Barras vermelhas = saiu.' : undefined}
      >
        <ResponsiveContainer width="100%" height={intuitive ? 280 : 240}>
          <BarChart data={flow}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => fmtBrl(v)} />
            <Legend />
            <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )

  const extraCharts = (
    <>
      <ChartCard title="Composição do patrimônio" subtitle={intuitive ? 'Onde está guardado o seu dinheiro hoje.' : undefined}>
        {patrimonyPie.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={patrimonyPie}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={pieLabel(intuitive, stats.cashBalance + stats.totalInvested + stats.totalCrypto)}
              >
                {patrimonyPie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => fmtBrl(v)} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <ChartCard title="Criptomoedas na carteira">
        {cryptoBreakdown.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={cryptoBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={pieLabel(
                  intuitive,
                  cryptoBreakdown.reduce((sum, x) => sum + x.value, 0),
                )}
              >
                {cryptoBreakdown.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => fmtBrl(v)} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Sem cripto registada." />
        )}
      </ChartCard>

      <ChartCard title="Evolução patrimonial" className="lg:col-span-2">
        {patrimony.length > 1 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={patrimony}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmtBrl(v)} />
              <Legend />
              <Line type="monotone" dataKey="netWorth" name="Patrimônio líquido" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="total" name="Patrimônio total" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Registre movimentações por alguns dias para ver a evolução." />
        )}
      </ChartCard>

      {incomePie.length > 0 ? (
        <ChartCard title={`Receitas por categoria${rangeSuffix}`}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={incomePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={pieLabel(intuitive, incomePie.reduce((s, x) => s + x.value, 0))}>
                {incomePie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => fmtBrl(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
    </>
  )

  if (intuitive) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">{primaryCharts}</div>
        <details className="rounded-2xl border border-border/40 bg-card/20 p-4">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Mais gráficos (patrimônio, cripto, evolução)
          </summary>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">{extraCharts}</div>
        </details>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {primaryCharts}
      {extraCharts}
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm ${className ?? ''}`}>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {subtitle ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p> : null}
      <div className={subtitle ? 'mt-3' : 'mt-3'}>{children}</div>
    </div>
  )
}

function EmptyChart({ message = 'Sem dados ainda.' }: { message?: string }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{message}</p>
}
