import type { NeonSyncDomain } from '@/lib/neon/constants'

const timers = new Map<NeonSyncDomain, ReturnType<typeof setTimeout>>()
const handlers = new Map<NeonSyncDomain, () => void | Promise<void>>()

export function registerNeonPushHandler(
  domain: NeonSyncDomain,
  fn: () => void | Promise<void>,
): void {
  handlers.set(domain, fn)
}

export function scheduleNeonPush(domain: NeonSyncDomain, delayMs = 2500): void {
  if (typeof window === 'undefined') return
  const prev = timers.get(domain)
  if (prev) clearTimeout(prev)
  timers.set(
    domain,
    setTimeout(() => {
      timers.delete(domain)
      void handlers.get(domain)?.()
    }, delayMs),
  )
}

export function clearNeonPushSchedules(): void {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
}
