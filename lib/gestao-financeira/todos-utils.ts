import type { GfTodo } from '@/lib/gestao-financeira/types'

export type GfTodoGroupKey = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'done'

export type GfTodoGroup = {
  key: GfTodoGroupKey
  label: string
  items: GfTodo[]
}

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function formatTodoDateLabel(dueDate: string, today = new Date()): string {
  const todayKey = dateKey(today)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = dateKey(tomorrow)

  if (dueDate === todayKey) return 'Hoje'
  if (dueDate === tomorrowKey) return 'Amanhã'

  const [y, m, d] = dueDate.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

export function groupGfTodos(todos: GfTodo[], today = new Date()): GfTodoGroup[] {
  const todayKey = dateKey(today)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = dateKey(tomorrow)
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndKey = dateKey(weekEnd)

  const buckets: Record<GfTodoGroupKey, GfTodo[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    week: [],
    later: [],
    done: [],
  }

  for (const todo of todos) {
    if (todo.completed) {
      buckets.done.push(todo)
      continue
    }
    if (todo.dueDate < todayKey) {
      buckets.overdue.push(todo)
    } else if (todo.dueDate === todayKey) {
      buckets.today.push(todo)
    } else if (todo.dueDate === tomorrowKey) {
      buckets.tomorrow.push(todo)
    } else if (todo.dueDate <= weekEndKey) {
      buckets.week.push(todo)
    } else {
      buckets.later.push(todo)
    }
  }

  const labels: Record<GfTodoGroupKey, string> = {
    overdue: 'Atrasados',
    today: 'Hoje',
    tomorrow: 'Amanhã',
    week: 'Esta semana',
    later: 'Depois',
    done: 'Concluídos',
  }

  const order: GfTodoGroupKey[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'done']
  return order
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, label: labels[key], items: buckets[key]! }))
}

export function countGfTodosToday(todos: GfTodo[], today = new Date()): number {
  const todayKey = dateKey(today)
  return todos.filter((t) => !t.completed && t.dueDate === todayKey).length
}
