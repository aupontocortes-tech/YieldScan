'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { categoryTotals, getMonthRange, isInRange } from '@/lib/gestao-financeira/calculations'
import { resolveExpenseCategoryName } from '@/lib/gestao-financeira/category-hints'
import { DEFAULT_GF_CATEGORIES } from '@/lib/gestao-financeira/categories-default'
import type { GfCategory, GfTransaction } from '@/lib/gestao-financeira/types'
import { cn } from '@/lib/utils'
import { ChevronDown, PieChart, Trash2 } from 'lucide-react'

type Props = {
  transactions: GfTransaction[]
  categories: GfCategory[]
  fmtBrl: (n: number) => string
  onDelete: (id: string, label: string) => void
}

const CATEGORY_ICON: Record<string, string> = Object.fromEntries(
  DEFAULT_GF_CATEGORIES.map((c) => [c.name.toLowerCase(), c.icon]),
)

function categoryIcon(name: string): string {
  return CATEGORY_ICON[name.toLowerCase()] ?? '📌'
}

function monthTitle(d = new Date()): string {
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function TransactionRow({
  t,
  categories,
  fmtBrl,
  onDelete,
  compact,
}: {
  t: GfTransaction
  categories: GfCategory[]
  fmtBrl: (n: number) => string
  onDelete: (id: string, label: string) => void
  compact?: boolean
}) {
  const cat = categories.find((c) => c.id === t.categoryId)
  const label = t.description ?? cat?.name ?? t.type
  const bucket = resolveExpenseCategoryName(t, categories)

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 text-sm',
        compact ? 'px-3 py-2' : 'px-4 py-3',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          {new Date(t.occurredAt).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {!compact && t.type === 'expense' ? ` · ${bucket}` : ''}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 tabular-nums font-semibold',
          t.type === 'income' ? 'text-emerald-400' : t.type === 'expense' ? 'text-red-400' : 'text-blue-300',
        )}
      >
        {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '↔'}
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
  const monthLabel = monthTitle()

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

  const topCategory = expenseByCategory[0] ?? null

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

  const txsForCategoryName = (catName: string) =>
    sortedTransactions.filter((t) => {
      if (t.type !== 'expense') return false
      if (!isInRange(t.occurredAt, monthRange)) return false
      return resolveExpenseCategoryName(t, categories) === catName
    })

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
    <div className="space-y-4">
      {/* ── Resumo por categoria ── */}
      <section className="overflow-hidden rounded-2xl border border-border/50 bg-card/30">
        <header className="border-b border-border/40 px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <PieChart className="h-4 w-4 shrink-0 text-amber-400/90" aria-hidden />
                Para onde foi o dinheiro
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{monthLabel}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total gastos</p>
              <p className="text-base font-semibold tabular-nums text-red-400">
                {monthExpenseTotal > 0 ? fmtBrl(monthExpenseTotal) : '—'}
              </p>
            </div>
          </div>
          {topCategory && monthExpenseTotal > 0 ? (
            <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-100/90">
              Maior gasto: <span className="font-semibold">{topCategory.name}</span>
              {' · '}
              {fmtBrl(topCategory.value)} (
              {Math.round((topCategory.value / monthExpenseTotal) * 100)}% do mês)
            </p>
          ) : null}
        </header>

        {expenseByCategory.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Ainda não há despesas neste mês.
          </p>
        ) : (
          <ul className="divide-y divide-border/25">
            {expenseByCategory.map(({ name, value, count }, index) => {
              const open = expandedCat === name
              const items = open ? txsForCategoryName(name) : []
              const pct = monthExpenseTotal > 0 ? Math.round((value / monthExpenseTotal) * 100) : 0
              const isTop = index === 0

              return (
                <li key={name} className={cn(isTop && 'bg-amber-500/[0.04]')}>
                  <button
                    type="button"
                    className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/25"
                    onClick={() => setExpandedCat(open ? null : name)}
                    aria-expanded={open}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base',
                        isTop ? 'bg-amber-500/15' : 'bg-muted/40',
                      )}
                      aria-hidden
                    >
                      {categoryIcon(name)}
                    </span>

                    <span className="min-w-0 flex-1 space-y-1.5">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium">{name}</span>
                            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                              #{index + 1}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {count} {count === 1 ? 'lançamento' : 'lançamentos'} · {pct}% do mês
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <span className="tabular-nums text-sm font-semibold text-red-400">
                            {fmtBrl(value)}
                          </span>
                          <ChevronDown
                            className={cn(
                              'h-3.5 w-3.5 text-muted-foreground transition-transform',
                              open && 'rotate-180',
                            )}
                          />
                        </span>
                      </span>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-muted/50">
                        <span
                          className={cn(
                            'block h-full rounded-full transition-[width]',
                            isTop ? 'bg-amber-400/80' : 'bg-red-500/55',
                          )}
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </span>
                    </span>
                  </button>

                  {open ? (
                    <div className="border-t border-border/20 bg-background/40">
                      {items.length === 0 ? (
                        <p className="px-4 py-2.5 text-xs text-muted-foreground">Sem itens.</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto divide-y divide-border/20">
                          {items.map((t) => (
                            <TransactionRow
                              key={t.id}
                              t={t}
                              categories={categories}
                              fmtBrl={fmtBrl}
                              onDelete={onDelete}
                              compact
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── Histórico ── */}
      <section className="overflow-hidden rounded-2xl border border-border/50 bg-card/20">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Histórico recente</p>
            {filterLabel && filteredMonthTotal != null ? (
              <p className="text-xs text-muted-foreground">
                Filtro: {filterLabel} · {fmtBrl(filteredMonthTotal)} este mês
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Últimas movimentações</p>
            )}
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="max-w-[12rem] truncate rounded-lg border border-border/60 bg-background/80 px-2.5 py-1.5 text-xs text-foreground"
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
        </header>
        <div className="max-h-80 overflow-y-auto divide-y divide-border/25">
          {filteredHistory.map((t) => (
            <TransactionRow key={t.id} t={t} categories={categories} fmtBrl={fmtBrl} onDelete={onDelete} />
          ))}
          {filteredHistory.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {categoryFilter === 'all' ? 'Nenhuma movimentação ainda.' : 'Nenhuma movimentação nesta categoria.'}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
