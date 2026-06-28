'use client'

import { useCallback, useEffect, useRef } from 'react'
import { GF_DATA_CHANGED_EVENT } from '@/lib/gestao-financeira/save-parsed-voice'
import {
  runTodoNotificationCheck,
  syncTodosToServiceWorker,
} from '@/lib/gestao-financeira/todo-notifications'
import type { GfTodo } from '@/lib/gestao-financeira/types'

const CHECK_INTERVAL_MS = 60_000

export function useGfTodoNotifications(todos: GfTodo[]) {
  const todosRef = useRef(todos)
  todosRef.current = todos

  const runCheck = useCallback(async () => {
    const list = todosRef.current
    await syncTodosToServiceWorker(list)
    await runTodoNotificationCheck(list)
  }, [])

  useEffect(() => {
    void runCheck()
  }, [todos, runCheck])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runCheck()
    }
    document.addEventListener('visibilitychange', onVisible)

    const timer = window.setInterval(() => {
      void runCheck()
    }, CHECK_INTERVAL_MS)

    const onData = () => void runCheck()
    window.addEventListener(GF_DATA_CHANGED_EVENT, onData)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
      window.removeEventListener(GF_DATA_CHANGED_EVENT, onData)
    }
  }, [runCheck])
}
