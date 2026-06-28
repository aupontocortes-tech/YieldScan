'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useGestaoFinanceira } from '@/hooks/use-gestao-financeira'
import { GfTodoNotifyEnableInline } from '@/components/gestao-financeira/gf-todo-notify-banner'
import { formatTodoDateLabel, groupGfTodos, countGfTodosToday } from '@/lib/gestao-financeira/todos-utils'
import type { GfTodo, GfTodoPriority } from '@/lib/gestao-financeira/types'
import { cn } from '@/lib/utils'
import { CalendarCheck, Clock, Trash2 } from 'lucide-react'

const PRIORITY_LABEL: Record<GfTodoPriority, string> = {
  high: 'Urgente',
  normal: 'Normal',
  low: 'Baixa',
}

const PRIORITY_CLASS: Record<GfTodoPriority, string> = {
  high: 'border-rose-500/40 bg-rose-950/30 text-rose-300',
  normal: 'border-border/50 bg-muted/30 text-muted-foreground',
  low: 'border-border/40 bg-transparent text-muted-foreground/80',
}

function todayInputValue(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function TodoRow({
  todo,
  onToggle,
  onDelete,
}: {
  todo: GfTodo
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const overdue = !todo.completed && todo.dueDate < todayInputValue()

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors',
        todo.completed
          ? 'border-border/30 bg-muted/20 opacity-70'
          : overdue
            ? 'border-amber-500/35 bg-amber-950/15'
            : 'border-border/45 bg-card/50 hover:border-border/70',
      )}
    >
      <Checkbox
        checked={todo.completed}
        onCheckedChange={() => onToggle(todo.id)}
        className="mt-0.5"
        aria-label={todo.completed ? 'Marcar pendente' : 'Marcar concluído'}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium leading-snug', todo.completed && 'line-through text-muted-foreground')}>
          {todo.title}
        </p>
        {todo.notes ? <p className="mt-0.5 text-xs text-muted-foreground">{todo.notes}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <CalendarCheck className="size-3" />
            {formatTodoDateLabel(todo.dueDate)}
          </span>
          {todo.dueTime ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3" />
              {todo.dueTime}
            </span>
          ) : null}
          <Badge variant="outline" className={cn('text-[10px]', PRIORITY_CLASS[todo.priority])}>
            {PRIORITY_LABEL[todo.priority]}
          </Badge>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(todo.id)}
        aria-label="Excluir"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

export function GfAfazeres({ gf }: { gf: ReturnType<typeof useGestaoFinanceira> }) {
  const groups = useMemo(() => groupGfTodos(gf.todos), [gf.todos])
  const pendingToday = useMemo(() => countGfTodosToday(gf.todos), [gf.todos])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Afazeres do dia</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use o painel acima para registar. Active os lembretes no aviso amarelo/roxo para receber alertas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-violet-500/35 bg-violet-950/20 text-violet-200">
            {pendingToday} para hoje
          </Badge>
          <GfTodoNotifyEnableInline todos={gf.todos} />
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 py-12 text-center text-sm text-muted-foreground">
          Nenhum afazer ainda. Registre no painel de cima e clique Interpretar → Salvar.
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <h3
              className={cn(
                'text-xs font-bold uppercase tracking-wider',
                group.key === 'overdue' ? 'text-amber-400' : group.key === 'done' ? 'text-muted-foreground' : 'text-foreground/90',
              )}
            >
              {group.label}
              <span className="ml-2 font-normal normal-case text-muted-foreground">({group.items.length})</span>
            </h3>
            <div className="space-y-2">
              {group.items.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  onToggle={(id) => void gf.toggleTodo(id)}
                  onDelete={(id) => void gf.removeTodo(id)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
