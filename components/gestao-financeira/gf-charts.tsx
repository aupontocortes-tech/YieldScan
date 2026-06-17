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
import type { GfPatrimonySnapshot, GfTransaction } from '@/lib/gestao-financeira/types'
import {
  categoryTotals,
  monthlyFlowSeries,
  patrimonyEvolutionSeries,
} from '@/lib/gestao-financeira/calculations'

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

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
}

export function GfCharts({ transactions, categories, snapshots, stats, cryptoBreakdown }: Props) {
  const expensePie = categoryTotals(transactions, categories, 'expense')
  const incomePie = categoryTotals(transactions, categories, 'income')
  const monthly = monthlyFlowSeries(transactions)
  const patrimony = patrimonyEvolutionSeries(snapshots)

  const patrimonyPie = [
    { name: 'Caixa', value: stats.cashBalance },
    { name: 'Investimentos', value: stats.totalInvested },
    { name: 'Cripto', value: stats.totalCrypto },
  ].filter((x) => x.value > 0)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="Despesas por categoria (mês)">
        {expensePie.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={expensePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {expensePie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR')}`} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <ChartCard title="Composição do patrimônio">
        {patrimonyPie.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={patrimonyPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {patrimonyPie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR')}`} />
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
              <Pie data={cryptoBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {cryptoBreakdown.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR')}`} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <ChartCard title="Receitas vs despesas">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR')}`} />
            <Legend />
            <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Evolução patrimonial" className="lg:col-span-2">
        {patrimony.length > 1 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={patrimony}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR')}`} />
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
        <ChartCard title="Receitas por categoria (mês)">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={incomePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {incomePie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR')}`} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
    </div>
  )
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm ${className ?? ''}`}>
      <h4 className="mb-3 text-sm font-semibold text-foreground">{title}</h4>
      {children}
    </div>
  )
}

function EmptyChart({ message = 'Sem dados ainda.' }: { message?: string }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{message}</p>
}
