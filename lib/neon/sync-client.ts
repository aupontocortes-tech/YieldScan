import { getDeviceUserId } from '@/lib/neon/device-user'
import { readSyncMeta, writeSyncMeta } from '@/lib/neon/sync-meta'
import { NEON_USER_HEADER, type NeonSyncDomain } from '@/lib/neon/constants'

export type NeonSyncPullResult = {
  ok: boolean
  configured: boolean
  payload: unknown | null
  updatedAt: string | null
  error?: string
}

export type NeonSyncPushResult = {
  ok: boolean
  configured: boolean
  updatedAt: string | null
  error?: string
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function pullNeonSync(domain: NeonSyncDomain): Promise<NeonSyncPullResult> {
  const userId = getDeviceUserId()
  if (!userId) return { ok: false, configured: false, payload: null, updatedAt: null, error: 'Sem ID de dispositivo.' }

  try {
    const res = await fetch(`/api/sync/${domain}`, {
      headers: { [NEON_USER_HEADER]: userId },
      cache: 'no-store',
    })
    const json = await parseJson(res)
    if (res.status === 503) {
      return { ok: false, configured: false, payload: null, updatedAt: null }
    }
    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        payload: null,
        updatedAt: null,
        error: typeof json.error === 'string' ? json.error : `Erro ${res.status}`,
      }
    }
    const updatedAt = typeof json.updatedAt === 'string' ? json.updatedAt : null
    if (updatedAt) writeSyncMeta(domain, updatedAt)
    return {
      ok: true,
      configured: true,
      payload: json.payload ?? null,
      updatedAt,
    }
  } catch {
    return { ok: false, configured: true, payload: null, updatedAt: null, error: 'Falha de rede.' }
  }
}

export async function pushNeonSync(
  domain: NeonSyncDomain,
  payload: unknown,
  clientUpdatedAt?: string | null,
): Promise<NeonSyncPushResult> {
  const userId = getDeviceUserId()
  if (!userId) return { ok: false, configured: false, updatedAt: null, error: 'Sem ID de dispositivo.' }

  try {
    const res = await fetch(`/api/sync/${domain}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        [NEON_USER_HEADER]: userId,
      },
      body: JSON.stringify({ payload, clientUpdatedAt: clientUpdatedAt ?? readSyncMeta()[domain]?.updatedAt ?? null }),
    })
    const json = await parseJson(res)
    if (res.status === 503) {
      return { ok: false, configured: false, updatedAt: null }
    }
    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        updatedAt: null,
        error: typeof json.error === 'string' ? json.error : `Erro ${res.status}`,
      }
    }
    const updatedAt = typeof json.updatedAt === 'string' ? json.updatedAt : null
    if (updatedAt) writeSyncMeta(domain, updatedAt)
    return { ok: true, configured: true, updatedAt }
  } catch {
    return { ok: false, configured: true, updatedAt: null, error: 'Falha de rede.' }
  }
}

export function isRemoteNewer(domain: NeonSyncDomain, remoteUpdatedAt: string | null): boolean {
  if (!remoteUpdatedAt) return false
  const local = readSyncMeta()[domain]?.updatedAt
  if (!local) return true
  return new Date(remoteUpdatedAt).getTime() > new Date(local).getTime()
}
