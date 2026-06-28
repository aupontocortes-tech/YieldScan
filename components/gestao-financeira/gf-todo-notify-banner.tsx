'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  dismissTodoNotifyPrompt,
  getTodoNotificationPermission,
  isTodoNotifyEnabled,
  isTodoNotifyPromptDismissed,
  requestTodoNotificationPermission,
  summarizeTodoAlerts,
} from '@/lib/gestao-financeira/todo-notifications'
import type { GfTodo } from '@/lib/gestao-financeira/types'
import { cn } from '@/lib/utils'
import { Bell, BellRing } from 'lucide-react'

type Props = {
  todos: GfTodo[]
  className?: string
}

export function GfTodoNotifyBanner({ todos, className }: Props) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [enabled, setEnabled] = useState(false)
  const [enablePromptDismissed, setEnablePromptDismissed] = useState(false)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    setPermission(getTodoNotificationPermission())
    setEnabled(isTodoNotifyEnabled())
    setEnablePromptDismissed(isTodoNotifyPromptDismissed())
  }, [])

  const alerts = useMemo(() => summarizeTodoAlerts(todos), [todos])
  const hasAlerts = alerts.overdue.length > 0 || alerts.today.length > 0

  if (!hasAlerts) return null

  const needsPermission = permission !== 'granted' || !enabled
  const showEnablePrompt = needsPermission && !enablePromptDismissed

  const handleEnable = async () => {
    setRequesting(true)
    try {
      const result = await requestTodoNotificationPermission()
      setPermission(result)
      setEnabled(result === 'granted')
    } finally {
      setRequesting(false)
    }
  }

  const handleDismissEnable = () => {
    dismissTodoNotifyPrompt()
    setEnablePromptDismissed(true)
  }

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        alerts.overdue.length > 0
          ? 'border-amber-500/35 bg-amber-950/20'
          : 'border-violet-500/30 bg-violet-950/15',
        className,
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600/25 text-violet-300">
          {needsPermission ? <Bell className="size-4" /> : <BellRing className="size-4" />}
        </span>
        <div className="min-w-0 flex-1 text-sm">
          {alerts.overdue.length > 0 ? (
            <p className="font-medium text-amber-200">
              {alerts.overdue.length} atrasado{alerts.overdue.length > 1 ? 's' : ''}
              {alerts.today.length > 0 ? ` · ${alerts.today.length} para hoje` : ''}
            </p>
          ) : (
            <p className="font-medium text-violet-200">
              {alerts.today.length} afazer{alerts.today.length > 1 ? 'es' : ''} para hoje
              {alerts.dueSoon.length > 0 ? ` · ${alerts.dueSoon.length} nas próximas 2 h` : ''}
            </p>
          )}

          {needsPermission && showEnablePrompt ? (
            <p className="mt-1 text-muted-foreground">
              Toque em «Activar lembretes» para receber aviso no telemóvel na hora marcada.
            </p>
          ) : needsPermission ? (
            <p className="mt-1 text-muted-foreground">Lembretes desactivados — active em Afazeres quando quiser.</p>
          ) : (
            <p className="mt-1 text-muted-foreground">
              Lembretes activos — avisamos na hora ou ao abrir o YieldScan.
            </p>
          )}
        </div>
      </div>

      {showEnablePrompt ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-12">
          <Button
            type="button"
            size="sm"
            className="bg-violet-600 hover:bg-violet-500"
            disabled={requesting || permission === 'denied'}
            onClick={() => void handleEnable()}
          >
            {permission === 'denied' ? 'Bloqueado no browser' : requesting ? 'A pedir…' : 'Activar lembretes'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={handleDismissEnable}>
            Agora não
          </Button>
          {permission === 'denied' ? (
            <p className="w-full text-xs text-muted-foreground">
              Desbloqueie em Definições → YieldScan → Notificações.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Botão compacto na aba Afazeres para activar lembretes antes de haver tarefas hoje. */
export function GfTodoNotifyEnableInline({ todos }: { todos: GfTodo[] }) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setPermission(getTodoNotificationPermission())
    setEnabled(isTodoNotifyEnabled())
  }, [])

  const pending = todos.filter((t) => !t.completed).length
  if (pending === 0 || permission === 'granted' && enabled) return null
  if (permission === 'denied') return null

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="gap-2 border-violet-500/35"
      onClick={() =>
        void requestTodoNotificationPermission().then((r) => {
          setPermission(r)
          setEnabled(r === 'granted')
        })
      }
    >
      <Bell className="size-4 text-violet-400" />
      Activar lembretes
    </Button>
  )
}
