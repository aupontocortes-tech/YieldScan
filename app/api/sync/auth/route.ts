import { NextResponse } from 'next/server'
import { NEON_USER_HEADER } from '@/lib/neon/constants'
import { ensureNeonSchema, getNeonSql, isNeonConfigured } from '@/lib/neon/server'
import { derivePassKey, normalizePassphrase, validatePassphrase } from '@/lib/neon/sync-passkey'

export const runtime = 'nodejs'

function userIdFrom(req: Request): string | null {
  const id = req.headers.get(NEON_USER_HEADER)?.trim()
  if (!id || id.length < 8 || id.length > 128) return null
  return id
}

export async function GET(req: Request) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ configured: false, linked: false })
  }

  const userId = userIdFrom(req)
  if (!userId) {
    return NextResponse.json({ error: 'ID de dispositivo em falta.' }, { status: 400 })
  }

  try {
    await ensureNeonSchema()
    const sql = getNeonSql()
    const rows = await sql`
      SELECT pass_key FROM yieldscan_sync_passkeys WHERE user_id = ${userId} LIMIT 1
    `
    return NextResponse.json({ configured: true, linked: rows.length > 0 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro Neon'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ error: 'Neon não configurado.', configured: false }, { status: 503 })
  }

  let body: { action?: string; passphrase?: string }
  try {
    body = (await req.json()) as { action?: string; passphrase?: string }
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const action = body.action?.trim()
  const passphrase = typeof body.passphrase === 'string' ? body.passphrase : ''
  const validationError = validatePassphrase(passphrase)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const passKey = derivePassKey(normalizePassphrase(passphrase))

  try {
    await ensureNeonSchema()
    const sql = getNeonSql()

    if (action === 'login') {
      const rows = await sql`
        SELECT user_id FROM yieldscan_sync_passkeys WHERE pass_key = ${passKey} LIMIT 1
      `
      const row = rows[0] as { user_id: string } | undefined
      if (!row) {
        return NextResponse.json({ error: 'Senha incorrecta ou conta não encontrada.' }, { status: 401 })
      }
      return NextResponse.json({ ok: true, userId: row.user_id, configured: true })
    }

    if (action === 'register') {
      const userId = userIdFrom(req)
      if (!userId) {
        return NextResponse.json({ error: 'ID de dispositivo em falta.' }, { status: 400 })
      }

      const byKey = await sql`
        SELECT user_id FROM yieldscan_sync_passkeys WHERE pass_key = ${passKey} LIMIT 1
      `
      const existingKey = byKey[0] as { user_id: string } | undefined
      if (existingKey) {
        if (existingKey.user_id === userId) {
          return NextResponse.json({ ok: true, userId, linked: true, configured: true })
        }
        return NextResponse.json(
          { error: 'Esta senha já está associada a outra conta.' },
          { status: 409 },
        )
      }

      const byUser = await sql`
        SELECT pass_key FROM yieldscan_sync_passkeys WHERE user_id = ${userId} LIMIT 1
      `
      if (byUser.length > 0) {
        await sql`
          UPDATE yieldscan_sync_passkeys SET pass_key = ${passKey} WHERE user_id = ${userId}
        `
      } else {
        await sql`
          INSERT INTO yieldscan_sync_passkeys (pass_key, user_id) VALUES (${passKey}, ${userId})
        `
      }

      return NextResponse.json({ ok: true, userId, linked: true, configured: true })
    }

    return NextResponse.json({ error: 'Acção inválida.' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro Neon'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
