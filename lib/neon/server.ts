import { neon } from '@neondatabase/serverless'

let schemaReady = false

export function isNeonConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export function getNeonSql() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL não configurada.')
  return neon(url)
}

/** Cria tabela de sync se ainda não existir (idempotente). */
export async function ensureNeonSchema(): Promise<void> {
  if (schemaReady || !isNeonConfigured()) return
  const sql = getNeonSql()
  await sql`
    CREATE TABLE IF NOT EXISTS yieldscan_sync (
      user_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, domain)
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_yieldscan_sync_updated
    ON yieldscan_sync (updated_at DESC)
  `
  await sql`
    CREATE TABLE IF NOT EXISTS yieldscan_sync_passkeys (
      pass_key TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_yieldscan_sync_passkeys_user
    ON yieldscan_sync_passkeys (user_id)
  `
  schemaReady = true
}

export type NeonSyncRow = {
  user_id: string
  domain: string
  payload: unknown
  updated_at: string
}
