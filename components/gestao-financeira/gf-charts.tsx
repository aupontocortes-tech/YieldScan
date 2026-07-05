'use client'

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Label,
  Legend,
  Line,
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
import {
  AXIS_TICK,
  CARD_THEMES,
  BAR_EXPENSE_COLOR,
  BAR_INCOME_COLOR,
  ChartSvgDefs,
  fmtBrlChart,
  GfChartTooltip,
  GRID_STROKE,
  pieSliceColor,
  sanitizePieSlices,
} from '@/components/gestao-financeira/gf-chart-visuals'

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
  const expensePie = sanitizePieSlices(
    categoryTotals(transactions, categories, 'expense', reportRange),
  )
  const incomePie = sanitizePieSlices(categoryTotals(transactions, categories, 'income', reportRange))
  const expenseTotal = expensePie.reduce((s, x) => s + x.value, 0)
  const incomeTotal = incomePie.reduce((s, x) => s + x.value, 0)
  const flow = reportRange
    ? flowSeriesForRange(transactions, reportRange)
    : monthlyFlowSeries(transactions).map((m) => ({
        label: m.month,
        income: m.income,
        expense: m.expense,
      }))
  const patrimony = patrimonyEvolutionSeries(snapshots)

  const patrimonyPie = sanitizePieSlices([
    { name: 'Caixa', value: stats.cashBalance },
    { name: 'Investimentos', value: stats.totalInvested },
    { name: 'Cripto', value: stats.totalCrypto },
  ])
  const patrimonyTotal = patrimonyPie.reduce((sum, x) => sum + x.value, 0)
  const cryptoPie = sanitizePieSlices(cryptoBreakdown)
  const cryptoTotal = cryptoPie.reduce((sum, x) => sum + x.value, 0)

  const expenseTitle = intuitive ? 'Para onde foi o dinheiro' : `Despesas por categoria${rangeSuffix}`
  const flowTitle = intuitive
    ? reportRange
      ? `Receitas e despesas${rangeSuffix}`
      : 'Receitas e despesas (últimos 6 meses)'
    : reportRange
      ? `Receitas vs despesas${rangeSuffix}`
      : 'Receitas vs despesas (últimos 6 meses)'

  const chartHeight = intuitive ? 280 : 260
  const innerR = intuitive ? 58 : 50
  const outerR = intuitive ? 96 : 84

  const primaryCharts = (
    <>
      <ChartCard
        themeIndex={0}
        title={expenseTitle}
        subtitle={intuitive ? chartHint ?? 'Cada cor é um tipo de gasto — a maior fatia pesa mais no bolso.' : undefined}
      >
        {expensePie.length ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <ChartSvgDefs />
              <Pie
                data={expensePie}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={innerR}
                outerRadius={outerR}
                paddingAngle={3}
                cornerRadius={6}
                stroke="#0f172a"
                strokeWidth={2}
                label={pieLabel(intuitive, expenseTotal)}
                labelLine={intuitive}
              >
                {expensePie.map((_, i) => (
                  <Cell key={i} fill={pieSliceColor(i)} />
                ))}
                <Label
                  value={fmtBrlChart(expenseTotal)}
                  position="center"
                  fill="#f8fafc"
                  style={{ fontSize: intuitive ? 15 : 13, fontWeight: 700 }}
                />
              </Pie>
              <Tooltip
                content={
                  <GfChartTooltip
                    valueFormatter={(v) => {
                      const pct = expenseTotal > 0 ? Math.round((v / expenseTotal) * 100) : 0
                      return intuitive ? `${fmtBrlChart(v)} (${pct}%)` : fmtBrlChart(v)
                    }}
                  />
                }
              />
              <Legend formatter={(value) => <span className="text-xs text-slate-300">{value}</span>} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Ainda não há despesas neste período." />
        )}
      </ChartCard>

      <ChartCard
        themeIndex={1}
        title={flowTitle}
        subtitle={intuitive ? 'Barras verdes = entrou dinheiro. Barras vermelhas = saiu.' : undefined}
      >
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={flow} barCategoryGap="22%" barGap={4}>
            <ChartSvgDefs />
            <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip content={<GfChartTooltip />} />
            <Legend formatter={(value) => <span className="text-xs text-slate-300">{value}</span>} iconType="circle" />
            <Bar
              dataKey="income"
              name="Receitas"
              fill={BAR_INCOME_COLOR}
              stroke="#0f172a"
              strokeWidth={1}
              radius={[8, 8, 2, 2]}
              maxBarSize={42}
            />
            <Bar
              dataKey="expense"
              name="Despesas"
              fill={BAR_EXPENSE_COLOR}
              stroke="#0f172a"
              strokeWidth={1}
              radius={[8, 8, 2, 2]}
              maxBarSize={42}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )

  const extraCharts = (
    <>
      <ChartCard themeIndex={2} title="Composição do patrimônio" subtitle={intuitive ? 'Onde está guardado o seu dinheiro hoje.' : undefined}>
        {patrimonyPie.length ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <ChartSvgDefs />
              <Pie
                data={patrimonyPie}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={innerR}
                outerRadius={outerR}
                paddingAngle={4}
                cornerRadius={6}
                stroke="#0f172a"
                strokeWidth={2}
                label={pieLabel(intuitive, patrimonyTotal)}
                labelLine={intuitive}
              >
                {patrimonyPie.map((_, i) => (
                  <Cell key={i} fill={pieSliceColor(i)} />
                ))}
                <Label
                  value={fmtBrlChart(patrimonyTotal)}
                  position="center"
                  fill="#f8fafc"
                  style={{ fontSize: 13, fontWeight: 700 }}
                />
              </Pie>
              <Tooltip content={<GfChartTooltip />} />
              <Legend formatter={(value) => <span className="text-xs text-slate-300">{value}</span>} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <ChartCard themeIndex={3} title="Criptomoedas na carteira">
        {cryptoPie.length ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <ChartSvgDefs />
              <Pie
                data={cryptoPie}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={innerR}
                outerRadius={outerR}
                paddingAngle={3}
                cornerRadius={6}
                stroke="#0f172a"
                strokeWidth={2}
                label={pieLabel(intuitive, cryptoTotal)}
                labelLine={intuitive}
              >
                {cryptoPie.map((_, i) => (
                  <Cell key={i} fill={pieSliceColor(i)} />
                ))}
                <Label
                  value={fmtBrlChart(cryptoTotal)}
                  position="center"
                  fill="#f8fafc"
                  style={{ fontSize: 13, fontWeight: 700 }}
                />
              </Pie>
              <Tooltip content={<GfChartTooltip />} />
              <Legend formatter={(value) => <span className="text-xs text-slate-300">{value}</span>} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Sem cripto registada." />
        )}
      </ChartCard>

      <ChartCard themeIndex={4} title="Evolução patrimonial" className="lg:col-span-2">
        {patrimony.length > 1 ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={patrimony}>
              <ChartSvgDefs />
              <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <Tooltip content={<GfChartTooltip />} />
              <Legend formatter={(value) => <span className="text-xs text-slate-300">{value}</span>} iconType="circle" />
              <Area type="monotone" dataKey="netWorth" fill="url(#gf-line-net)" stroke="none" legendType="none" />
              <Area type="monotone" dataKey="total" fill="url(#gf-line-total)" stroke="none" legendType="none" />
              <Line
                type="monotone"
                dataKey="netWorth"
                name="Patrimônio líquido"
                stroke="#34d399"
                strokeWidth={3}
                dot={{ r: 4, fill: '#34d399', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#6ee7b7' }}
              />
              <Line
                type="monotone"
                dataKey="total"
                name="Patrimônio total"
                stroke="#60a5fa"
                strokeWidth={3}
                dot={{ r: 4, fill: '#60a5fa', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#93c5fd' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Registre movimentações por alguns dias para ver a evolução." />
        )}
      </ChartCard>

      {incomePie.length > 0 ? (
        <ChartCard themeIndex={5} title={`Receitas por categoria${rangeSuffix}`}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <ChartSvgDefs />
              <Pie
                data={incomePie}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={innerR}
                outerRadius={outerR}
                paddingAngle={3}
                cornerRadius={6}
                stroke="#0f172a"
                strokeWidth={2}
                label={pieLabel(intuitive, incomeTotal)}
                labelLine={intuitive}
              >
                {incomePie.map((_, i) => (
                  <Cell key={i} fill={pieSliceColor(i)} />
                ))}
                <Label
                  value={fmtBrlChart(incomeTotal)}
                  position="center"
                  fill="#f8fafc"
                  style={{ fontSize: 13, fontWeight: 700 }}
                />
              </Pie>
              <Tooltip content={<GfChartTooltip />} />
              <Legend formatter={(value) => <span className="text-xs text-slate-300">{value}</span>} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
    </>
  )

  if (intuitive) {
    return (
      <div className="space-y-6 rounded-3xl bg-gradient-to-br from-violet-950/20 via-slate-950/40 to-emerald-950/20 p-1">
        <div className="grid gap-6 lg:grid-cols-2">{primaryCharts}</div>
        <details className="rounded-2xl border border-violet-400/20 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 p-4 backdrop-blur-sm">
          <summary className="cursor-pointer text-sm font-medium text-violet-200/90">
            Mais gráficos (patrimônio, cripto, evolução)
          </summary>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">{extraCharts}</div>
        </details>
      </div>
    )
  }

  return (
    <div className="grid gap-6 rounded-3xl bg-gradient-to-br from-indigo-950/25 via-slate-950/30 to-emerald-950/20 p-4 lg:grid-cols-2">
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
  themeIndex = 0,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
  themeIndex?: number
}) {
  const theme = CARD_THEMES[themeIndex % CARD_THEMES.length]!
  return (
    <div className={`rounded-2xl border p-4 backdrop-blur-md ${theme} ${className ?? ''}`}>
      <h4 className="text-sm font-semibold text-white/95">{title}</h4>
      {subtitle ? <p className="mt-1 text-xs leading-relaxed text-slate-300/90">{subtitle}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  )
}

function EmptyChart({ message = 'Sem dados ainda.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 h-14 w-14 rounded-full bg-gradient-to-br from-violet-400/40 via-fuchsia-400/30 to-cyan-400/40 shadow-lg shadow-violet-500/20" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}
