import type { GfTodo } from '@/lib/gestao-financeira/types'

const NOTIFIED_KEY = 'yieldscan_gf_todo_notified_v1'
const NOTIFY_ENABLED_KEY = 'yieldscan_gf_todo_notify_enabled_v1'
const DISMISS_PROMPT_KEY = 'yieldscan_gf_todo_notify_prompt_dismissed'

/** Hora local para lembretes do dia sem hora marcada. */
const MORNING_HOUR = 9
/** Hora mínima para avisar atrasados. */
const OVERDUE_HOUR = 8

export type GfTodoAlertSummary = {
  overdue: GfTodo[]
  today: GfTodo[]
  dueSoon: GfTodo[]
}

export type GfTodoNotifyCandidate = {
  todo: GfTodo
  title: string
  body: string
  notifyKey: string
}

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function readNotified(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function writeNotified(map: Record<string, string>): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map))
}

export function isTodoNotifyEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(NOTIFY_ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

export function setTodoNotifyEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(NOTIFY_ENABLED_KEY, enabled ? '1' : '0')
}

export function isTodoNotifyPromptDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(DISMISS_PROMPT_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissTodoNotifyPrompt(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DISMISS_PROMPT_KEY, '1')
}

export function getTodoNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestTodoNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') {
    setTodoNotifyEnabled(true)
    return 'granted'
  }
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  if (result === 'granted') setTodoNotifyEnabled(true)
  return result
}

export function summarizeTodoAlerts(todos: GfTodo[], now = new Date()): GfTodoAlertSummary {
  const todayKey = dateKey(now)
  const pending = todos.filter((t) => !t.completed)

  const overdue = pending.filter((t) => t.dueDate < todayKey)
  const today = pending.filter((t) => t.dueDate === todayKey)

  const dueSoon = today.filter((t) => {
    if (!t.dueTime) return false
    const [h, m] = t.dueTime.split(':').map(Number)
    if (h == null || m == null) return false
    const due = new Date(now)
    due.setHours(h, m, 0, 0)
    const diffMin = (due.getTime() - now.getTime()) / 60_000
    return diffMin >= 0 && diffMin <= 120
  })

  return { overdue, today, dueSoon }
}

function parseDueDateTime(todo: GfTodo): Date | null {
  if (!todo.dueTime) return null
  const [y, mo, d] = todo.dueDate.split('-').map(Number)
  const [h, mi] = todo.dueTime.split(':').map(Number)
  if (!y || !mo || !d || h == null || mi == null) return null
  return new Date(y, mo - 1, d, h, mi, 0, 0)
}

/** Decide quais lembretes devem disparar agora (ou ao abrir o app). */
export function collectTodoNotifyCandidates(todos: GfTodo[], now = new Date()): GfTodoNotifyCandidate[] {
  const todayKey = dateKey(now)
  const notified = readNotified()
  const out: GfTodoNotifyCandidate[] = []

  for (const todo of todos) {
    if (todo.completed) continue

    if (todo.dueDate < todayKey && now.getHours() >= OVERDUE_HOUR) {
      const notifyKey = `${todo.id}:overdue:${todayKey}`
      if (notified[todo.id] === notifyKey) continue
      out.push({
        todo,
        notifyKey,
        title: 'Afazer atrasado',
        body: todo.dueTime ? `${todo.title} · ${todo.dueTime}` : todo.title,
      })
      continue
    }

    if (todo.dueDate !== todayKey) continue

    if (todo.dueTime) {
      const due = parseDueDateTime(todo)
      if (!due) continue
      const diffMs = now.getTime() - due.getTime()
      if (diffMs < 0 || diffMs > 2 * 60 * 60 * 1000) continue
      const notifyKey = `${todo.id}:time:${todo.dueDate}T${todo.dueTime}`
      if (notified[todo.id] === notifyKey) continue
      out.push({
        todo,
        notifyKey,
        title: 'Lembrete de afazer',
        body: `${todo.title} · ${todo.dueTime}`,
      })
      continue
    }

    if (now.getHours() >= MORNING_HOUR) {
      const notifyKey = `${todo.id}:morning:${todayKey}`
      if (notified[todo.id] === notifyKey) continue
      out.push({
        todo,
        notifyKey,
        title: 'Afazer de hoje',
        body: todo.title,
      })
    }
  }

  return out
}

function markNotified(todoId: string, notifyKey: string): void {
  const map = readNotified()
  map[todoId] = notifyKey
  const keys = Object.keys(map)
  if (keys.length > 200) {
    for (const k of keys.slice(0, keys.length - 150)) delete map[k]
  }
  writeNotified(map)
}

export async function showTodoSystemNotification(
  candidate: GfTodoNotifyCandidate,
): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (Notification.permission !== 'granted' || !isTodoNotifyEnabled()) return false

  const { todo, title, body } = candidate
  const options: NotificationOptions = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `gf-todo-${todo.id}`,
    data: { url: '/news/gestao-financeira?tab=afazeres', todoId: todo.id },
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, options)
    } else {
      new Notification(title, options)
    }
    markNotified(todo.id, candidate.notifyKey)
    return true
  } catch {
    return false
  }
}

/** Verifica e dispara notificações pendentes. Devolve quantas foram enviadas. */
export async function runTodoNotificationCheck(todos: GfTodo[]): Promise<number> {
  if (typeof window === 'undefined') return 0
  if (Notification.permission !== 'granted' || !isTodoNotifyEnabled()) return 0

  const candidates = collectTodoNotifyCandidates(todos)
  let sent = 0
  for (const c of candidates) {
    const ok = await showTodoSystemNotification(c)
    if (ok) sent += 1
  }
  return sent
}

/** Envia todos pendentes para o service worker (app em segundo plano). */
export async function syncTodosToServiceWorker(todos: GfTodo[]): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    reg.active?.postMessage({
      type: 'GF_TODOS_SYNC',
      todos: todos.filter((t) => !t.completed).map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        dueTime: t.dueTime,
        completed: t.completed,
      })),
    })
  } catch {
    /* ignore */
  }
}
