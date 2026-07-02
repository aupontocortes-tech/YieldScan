import { NEON_DEVICE_USER_KEY } from '@/lib/neon/constants'

const ENV_USER_ID = process.env.NEXT_PUBLIC_YIELDSCAN_USER_ID?.trim() || ''

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `ys-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** ID anónimo por dispositivo — associa dados no Neon sem login. */
export function getDeviceUserId(): string {
  if (typeof window === 'undefined') return ENV_USER_ID
  try {
    if (ENV_USER_ID) {
      const stored = localStorage.getItem(NEON_DEVICE_USER_KEY)?.trim()
      if (stored !== ENV_USER_ID) localStorage.setItem(NEON_DEVICE_USER_KEY, ENV_USER_ID)
      return ENV_USER_ID
    }
    let id = localStorage.getItem(NEON_DEVICE_USER_KEY)?.trim()
    if (!id) {
      id = newId()
      localStorage.setItem(NEON_DEVICE_USER_KEY, id)
    }
    return id
  } catch {
    return ENV_USER_ID || newId()
  }
}
