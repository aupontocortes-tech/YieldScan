import type { StateStorage } from 'zustand/middleware'

/** Evita gravar localStorage a cada frame durante arraste de desenhos. */
export function createDebouncedStorage(delayMs = 450): StateStorage {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: { name: string; value: string } | null = null

  const flush = () => {
    if (pending) {
      localStorage.setItem(pending.name, pending.value)
      pending = null
    }
    timer = null
  }

  return {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      pending = { name, value }
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, delayMs)
    },
    removeItem: (name) => {
      if (timer) clearTimeout(timer)
      pending = null
      localStorage.removeItem(name)
    },
  }
}
