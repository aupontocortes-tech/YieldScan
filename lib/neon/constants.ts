/** Domínios de sincronização Neon (uma linha JSONB por utilizador). */
export const NEON_SYNC_DOMAINS = [
  'gestao_financeira',
  'portfolio',
  'indicators',
  'mercado',
  'tendencias',
  'wallets',
  'calculator',
  'news_state',
  'unlocks',
  'pools',
  'gf_prefs',
] as const

export type NeonSyncDomain = (typeof NEON_SYNC_DOMAINS)[number]

export function isNeonSyncDomain(v: string): v is NeonSyncDomain {
  return (NEON_SYNC_DOMAINS as readonly string[]).includes(v)
}

export const NEON_USER_HEADER = 'x-yieldscan-user-id'

export const NEON_DEVICE_USER_KEY = 'yieldscan_device_user_id_v1'

/** Disparado após login/registo de sync por senha — reinicia pull na nuvem. */
export const YIELDSCAN_SYNC_USER_CHANGED_EVENT = 'yieldscan-sync-user-changed'

export const NEON_SYNC_META_KEY = 'yieldscan_neon_sync_meta_v1'
