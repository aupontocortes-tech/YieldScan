'use client'

import type { GfEpigraphicReport } from '@/lib/gestao-financeira/report-document'
import { cn } from '@/lib/utils'

type Props = {
  report: GfEpigraphicReport
  fmtBrl: (n: number) => string
  className?: string
  id?: string
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h3 className="mb-2 border-b border-border/60 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'green' | 'red' | 'default'
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-base font-bold tabular-nums',
          tone === 'green' && 'text-emerald-500',
          tone === 'red' && 'text-red-500',
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function GfReportView({ report, fmtBrl, className, id }: Props) {
  const generated = new Date(report.generatedAt).toLocaleString('pt-BR')

  return (
    <article
      id={id}
      className={cn(
        'rounded-2xl border border-border/60 bg-white p-4 text-zinc-900 shadow-sm sm:p-6 print:shadow-none',
        className,
      )}
    >
      <header className="mb-4 border-b border-zinc-200 pb-3">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">YieldScan</p>
        <h2 className="text-xl font-bold text-zinc-900">Relatório financeiro</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Período: <span className="font-medium">{report.periodLabel}</span>
        </p>
        <p className="text-xs text-zinc-500">Gerado em {generated}</p>
      </header>

      <div className="space-y-5">
        <Section title="Resumo do período">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard label="Receitas" value={fmtBrl(report.period.income)} tone="green" />
            <SummaryCard label="Despesas" value={fmtBrl(report.period.expense)} tone="red" />
            <SummaryCard
              label="Economia"
              value={fmtBrl(report.period.savings)}
              tone={report.period.savings >= 0 ? 'green' : 'red'}
            />
            <SummaryCard label="Movimentações" value={String(report.period.transactionCount)} />
          </div>
        </Section>

        <Section title="Património actual">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <SummaryCard label="Caixa" value={fmtBrl(report.patrimony.cashBalance)} />
            <SummaryCard label="Cripto" value={fmtBrl(report.patrimony.totalCrypto)} />
            <SummaryCard label="Investimentos" value={fmtBrl(report.patrimony.totalInvested)} />
            <SummaryCard label="Dívidas" value={fmtBrl(report.patrimony.pendingDebts)} tone="red" />
            <SummaryCard label="Património total" value={fmtBrl(report.patrimony.totalPatrimony)} />
            <SummaryCard label="Património líquido" value={fmtBrl(report.patrimony.netWorth)} />
          </div>
        </Section>

        <Section title="Caixas">
          <table className="w-full text-sm">
            <tbody>
              {report.cashBoxes.map((b) => (
                <tr key={b.name} className="border-b border-zinc-100">
                  <td className="py-1.5">{b.name}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{fmtBrl(b.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Section title="Despesas por categoria">
            <CategoryList items={report.expenseByCategory} fmtBrl={fmtBrl} />
          </Section>
          <Section title="Receitas por categoria">
            <CategoryList items={report.incomeByCategory} fmtBrl={fmtBrl} />
          </Section>
        </div>

        {report.cryptoHoldings.length > 0 ? (
          <Section title="Cripto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="pb-1">Ativo</th>
                  <th className="pb-1 text-right">Qtd</th>
                  <th className="pb-1 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {report.cryptoHoldings.map((h) => (
                  <tr key={h.symbol} className="border-b border-zinc-100">
                    <td className="py-1.5 font-medium">{h.symbol}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {h.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}
                    </td>
                    <td className="py-1.5 text-right font-medium tabular-nums">{fmtBrl(h.valueBrl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        ) : null}

        {report.debts.length > 0 ? (
          <Section title="Dívidas pendentes">
            <table className="w-full text-sm">
              <tbody>
                {report.debts.map((d) => (
                  <tr key={d.name} className="border-b border-zinc-100">
                    <td className="py-1.5">{d.name}</td>
                    <td className="py-1.5 text-xs text-zinc-500">{d.dueDate?.slice(0, 10) ?? '—'}</td>
                    <td className="py-1.5 text-right font-medium text-red-600 tabular-nums">
                      {fmtBrl(d.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        ) : null}

        <Section title="Movimentações do período">
          {report.transactions.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhuma movimentação neste período.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto print:max-h-none">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-xs text-zinc-500">
                  <tr>
                    <th className="pb-1 pr-2">Data</th>
                    <th className="pb-1 pr-2">Tipo</th>
                    <th className="pb-1 pr-2">Descrição</th>
                    <th className="pb-1 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {report.transactions.map((t, i) => (
                    <tr key={`${t.date}-${i}`} className="border-b border-zinc-100">
                      <td className="py-1.5 pr-2 whitespace-nowrap text-xs text-zinc-600">{t.date}</td>
                      <td className="py-1.5 pr-2 text-xs">
                        {t.type === 'income' ? 'Receita' : t.type === 'expense' ? 'Despesa' : 'Transf.'}
                      </td>
                      <td className="py-1.5 pr-2">
                        <span className="font-medium">{t.description || t.category}</span>
                        <span className="block text-xs text-zinc-500">{t.cashBox}</span>
                      </td>
                      <td
                        className={cn(
                          'py-1.5 text-right font-medium tabular-nums',
                          t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-red-600' : 'text-zinc-600',
                        )}
                      >
                        {fmtBrl(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </article>
  )
}

function CategoryList({
  items,
  fmtBrl,
}: {
  items: { name: string; value: number }[]
  fmtBrl: (n: number) => string
}) {
  if (!items.length) return <p className="text-sm text-zinc-500">Sem registos.</p>
  return (
    <ul className="space-y-1 text-sm">
      {items.map((c) => (
        <li key={c.name} className="flex justify-between gap-2 border-b border-zinc-100 py-1">
          <span>{c.name}</span>
          <span className="font-medium tabular-nums">{fmtBrl(c.value)}</span>
        </li>
      ))}
    </ul>
  )
}
