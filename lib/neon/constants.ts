/** Domínios de sincronização Neon (uma linha JSONB por utilizador). */
export const NEON_SYNC_DOMAINS = [
  'gestao_financeira',
  'portfolio',
  'indicators',
] as const

export type NeonSyncDomain = (typeof NEON_SYNC_DOMAINS)[number]

export function isNeonSyncDomain(v: string): v is NeonSyncDomain {
  return (NEON_SYNC_DOMAINS as readonly string[]).includes(v)
}

export const NEON_USER_HEADER = 'x-yieldscan-user-id'

export const NEON_DEVICE_USER_KEY = 'yieldscan_device_user_id_v1'

export const NEON_SYNC_META_KEY = 'yieldscan_neon_sync_meta_v1'
