'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import {
  ArrowUpRight,
  Building2,
  CalendarCheck,
  CheckSquare,
  Landmark,
  Mic,
  PiggyBank,
  Wallet,
} from 'lucide-react'
import { HubPanel } from '@/components/dashboard/hub/hub-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { useGestaoFinanceira } from '@/hooks/use-gestao-financeira'
import {
  countGfTodosToday,
  formatTodoDateLabel,
  groupGfTodos,
} from '@/lib/gestao-financeira/todos-utils'
import { cn } from '@/lib/utils'

const GF_BASE = '/news/gestao-financeira'

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'green' | 'red' | 'amber' | 'blue'
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-background/40 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 font-mono text-sm font-bold tabular-nums tracking-tight',
          tone === 'green' && 'text-emerald-400',
          tone === 'red' && 'text-red-400',
          tone === 'amber' && 'text-amber-300',
          tone === 'blue' && 'text-sky-300',
          !tone && 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function QuickLink({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: typeof Wallet
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-white/[0.06] bg-muted/10 px-2.5 py-2',
        'text-[11px] font-medium text-muted-foreground transition-colors',
        'hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-400/90" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
      <ArrowUpRight className="ml-auto h-3 w-3 opacity-40" aria-hidden />
    </Link>
  )
}

export function HubFinance() {
  const gf = useGestaoFinanceira()
  const stats = gf.stats
  const pendingToday = useMemo(() => countGfTodosToday(gf.todos), [gf.todos])

  const upcomingTodos = useMemo(() => {
    const groups = groupGfTodos(gf.todos)
    const pick = (key: 'overdue' | 'today' | 'tomorrow') =>
      groups.find((g) => g.key === key)?.items.filter((t) => !t.completed) ?? []
    return [...pick('overdue'), ...pick('today'), ...pick('tomorrow')].slice(0, 5)
  }, [gf.todos])

  const overdueCount = useMemo(
    () => gf.todos.filter((t) => !t.completed && t.dueDate < new Date().toISOString().slice(0, 10)).length,
    [gf.todos],
  )

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
      <HubPanel
        title="Gestão Financeira"
        subtitle="Patrimônio, caixa e movimentos do mês"
        icon={Building2}
        accent="emerald"
        href={GF_BASE}
        linkLabel="Abrir painel"
      >
        {!gf.ready ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <StatPill
                label="Patrimônio"
                value={fmtBrl(stats?.totalPatrimony ?? 0)}
                tone="blue"
              />
              <StatPill label="Em caixa" value={fmtBrl(stats?.cashBalance ?? 0)} />
              <StatPill
                label="Receitas mês"
                value={fmtBrl(stats?.monthIncome ?? 0)}
                tone="green"
              />
              <StatPill
                label="Despesas mês"
                value={fmtBrl(stats?.monthExpense ?? 0)}
                tone="red"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <PiggyBank className="h-4 w-4 text-emerald-400" />
                Economia do mês
              </span>
              <span
                className={cn(
                  'font-mono text-sm font-bold tabular-nums',
                  (stats?.monthSavings ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {fmtBrl(stats?.monthSavings ?? 0)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <QuickLink href={`${GF_BASE}?tab=movimentos`} label="Movimentos" icon={Wallet} />
              <QuickLink href={`${GF_BASE}?tab=dividas`} label="Dívidas" icon={Landmark} />
              <QuickLink href={`${GF_BASE}?tab=relatorios`} label="Relatórios" icon={ArrowUpRight} />
              <QuickLink href="/news/gestao-financeira/microfone" label="Falar / voz" icon={Mic} />
            </div>
          </div>
        )}
      </HubPanel>

      <HubPanel
        title="Afazeres"
        subtitle="Tarefas do dia, lembretes e voz"
        icon={CheckSquare}
        accent="violet"
        href={`${GF_BASE}?tab=afazeres`}
        linkLabel="Ver todos"
      >
        {!gf.ready ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/35 bg-violet-950/30 px-2.5 py-1 text-[11px] font-semibold text-violet-200">
                <CalendarCheck className="h-3.5 w-3.5" />
                {pendingToday} para hoje
              </span>
              {overdueCount > 0 ? (
                <span className="inline-flex items-center rounded-full border border-amber-500/35 bg-amber-950/25 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                  {overdueCount} atrasado{overdueCount === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>

            {upcomingTodos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/50 px-3 py-6 text-center text-xs text-muted-foreground">
                Nenhum afazer pendente. Use o microfone ou o painel para adicionar.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {upcomingTodos.map((todo) => {
                  const overdue =
                    !todo.completed && todo.dueDate < new Date().toISOString().slice(0, 10)
                  return (
                    <li key={todo.id}>
                      <Link
                        href={`${GF_BASE}?tab=afazeres`}
                        className={cn(
                          'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
                          overdue
                            ? 'border-amber-500/30 bg-amber-950/15 hover:border-amber-500/45'
                            : 'border-white/[0.06] bg-background/40 hover:border-violet-500/30 hover:bg-violet-950/10',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                            overdue ? 'bg-amber-400' : 'bg-violet-400',
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-foreground">{todo.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatTodoDateLabel(todo.dueDate)}
                            {todo.dueTime ? ` · ${todo.dueTime}` : ''}
                          </p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
              <QuickLink href={`${GF_BASE}?tab=afazeres`} label="Lista completa" icon={CheckSquare} />
              <QuickLink href="/news/gestao-financeira/microfone" label="Registar por voz" icon={Mic} />
            </div>
          </div>
        )}
      </HubPanel>
    </div>
  )
}
