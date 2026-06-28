import { NEON_DEVICE_USER_KEY } from '@/lib/neon/constants'

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `ys-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** ID anónimo por dispositivo — associa dados no Neon sem login. */
export function getDeviceUserId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = localStorage.getItem(NEON_DEVICE_USER_KEY)?.trim()
    if (!id) {
      id = newId()
      localStorage.setItem(NEON_DEVICE_USER_KEY, id)
    }
    return id
  } catch {
    return newId()
  }
}
