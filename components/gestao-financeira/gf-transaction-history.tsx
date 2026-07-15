'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { categoryTotals, getMonthRange, isInRange } from '@/lib/gestao-financeira/calculations'
import { resolveExpenseCategoryName } from '@/lib/gestao-financeira/category-hints'
import type { GfCategory, GfTransaction } from '@/lib/gestao-financeira/types'
import { cn } from '@/lib/utils'
import { ChevronDown, Trash2 } from 'lucide-react'

type Props = {
  transactions: GfTransaction[]
  categories: GfCategory[]
  fmtBrl: (n: number) => string
  onDelete: (id: string, label: string) => void
}

function TransactionRow({
  t,
  categories,
  fmtBrl,
  onDelete,
}: {
  t: GfTransaction
  categories: GfCategory[]
  fmtBrl: (n: number) => string
  onDelete: (id: string, label: string) => void
}) {
  const cat = categories.find((c) => c.id === t.categoryId)
  const label = t.description ?? cat?.name ?? t.type

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{new Date(t.occurredAt).toLocaleString('pt-BR')}</p>
      </div>
      <span
        className={cn(
          'shrink-0 font-semibold',
          t.type === 'income' ? 'text-emerald-400' : t.type === 'expense' ? 'text-red-400' : 'text-blue-300',
        )}
      >
        {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '↔'}
        {fmtBrl(t.amount)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-400"
        aria-label={`Excluir ${label}`}
        onClick={() => onDelete(t.id, label)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function GfTransactionHistory({ transactions, categories, fmtBrl, onDelete }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [expandedCat, setExpandedCat] = useState<string | null>(null)

  const monthRange = getMonthRange()

  const filterCategories = useMemo(() => {
    const ids = new Set(transactions.map((t) => t.categoryId).filter(Boolean) as string[])
    return categories.filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [transactions, categories])

  const expenseByCategory = useMemo(
    () => categoryTotals(transactions, categories, 'expense', monthRange),
    [transactions, categories, monthRange],
  )

  const monthExpenseTotal = useMemo(
    () => expenseByCategory.reduce((s, r) => s + r.value, 0),
    [expenseByCategory],
  )

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [transactions],
  )

  const filteredHistory = useMemo(() => {
    if (categoryFilter === 'all') return sortedTransactions.slice(0, 40)
    if (categoryFilter === '__none__') {
      return sortedTransactions.filter((t) => !t.categoryId).slice(0, 40)
    }
    return sortedTransactions.filter((t) => t.categoryId === categoryFilter).slice(0, 40)
  }, [sortedTransactions, categoryFilter])

  const txsForCategoryName = (catName: string) => {
    return sortedTransactions.filter((t) => {
      if (t.type !== 'expense') return false
      if (!isInRange(t.occurredAt, monthRange)) return false
      return resolveExpenseCategoryName(t, categories) === catName
    })
  }

  const filterLabel =
    categoryFilter === 'all'
      ? null
      : categoryFilter === '__none__'
        ? 'Sem categoria'
        : categories.find((c) => c.id === categoryFilter)?.name

  const filteredMonthTotal = useMemo(() => {
    if (!filterLabel) return null
    const row = expenseByCategory.find((r) => r.name === filterLabel)
    return row?.value ?? null
  }, [filterLabel, expenseByCategory])

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/50 overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/40 px-4 py-3">
          <div>
            <p className="font-semibold">Gastos por categoria · este mês</p>
            <p className="text-xs text-muted-foreground">
              Mercado, gasolina, padaria… juntos com o total de cada um
            </p>
          </div>
          {monthExpenseTotal > 0 ? (
            <p className="text-sm font-semibold text-red-400">Total {fmtBrl(monthExpenseTotal)}</p>
          ) : null}
        </div>

        {expenseByCategory.length === 0 ? (
          <p className="px-4 py-4 text-xs text-muted-foreground">Nenhuma despesa neste mês.</p>
        ) : (
          <div className="divide-y divide-border/30">
            {expenseByCategory.map(({ name, value, count }) => {
              const open = expandedCat === name
              const items = open ? txsForCategoryName(name) : []
              const pct = monthExpenseTotal > 0 ? Math.round((value / monthExpenseTotal) * 100) : 0
              return (
                <div key={name}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1.5 px-4 py-3 text-left hover:bg-muted/20"
                    onClick={() => setExpandedCat(open ? null : name)}
                    aria-expanded={open}
                  >
                    <span className="flex w-full items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                            open && 'rotate-180',
                          )}
                        />
                        {name}
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {count}x · {pct}%
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold text-red-400">{fmtBrl(value)}</span>
                    </span>
                    <span className="ml-5 h-1.5 overflow-hidden rounded-full bg-muted/40">
                      <span
                        className="block h-full rounded-full bg-red-500/70"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </span>
                  </button>
                  {open && items.length > 0 ? (
                    <div className="max-h-44 overflow-y-auto border-t border-border/20 bg-muted/5 divide-y divide-border/20">
                      {items.map((t) => (
                        <TransactionRow
                          key={t.id}
                          t={t}
                          categories={categories}
                          fmtBrl={fmtBrl}
                          onDelete={onDelete}
                        />
                      ))}
                    </div>
                  ) : null}
                  {open && items.length === 0 ? (
                    <p className="border-t border-border/20 px-4 py-2 text-xs text-muted-foreground">Sem itens.</p>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/50 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
          <div>
            <p className="font-semibold">Histórico recente</p>
            {filterLabel && filteredMonthTotal != null ? (
              <p className="text-xs text-muted-foreground">
                {filterLabel} · {fmtBrl(filteredMonthTotal)} este mês
              </p>
            ) : null}
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="max-w-[11rem] truncate rounded-md border border-border/60 bg-background/80 px-2 py-1 text-xs text-foreground"
            aria-label="Filtrar por categoria"
          >
            <option value="all">Todas categorias</option>
            {filterCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {sortedTransactions.some((t) => !t.categoryId) ? (
              <option value="__none__">Sem categoria</option>
            ) : null}
          </select>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border/30">
          {filteredHistory.map((t) => (
            <TransactionRow key={t.id} t={t} categories={categories} fmtBrl={fmtBrl} onDelete={onDelete} />
          ))}
          {filteredHistory.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {categoryFilter === 'all' ? 'Nenhuma movimentação ainda.' : 'Nenhuma movimentação nesta categoria.'}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
