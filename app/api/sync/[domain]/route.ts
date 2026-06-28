import { NextResponse } from 'next/server'
import { isNeonSyncDomain, NEON_USER_HEADER } from '@/lib/neon/constants'
import { ensureNeonSchema, getNeonSql, isNeonConfigured } from '@/lib/neon/server'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ domain: string }> }

function userIdFrom(req: Request): string | null {
  const id = req.headers.get(NEON_USER_HEADER)?.trim()
  if (!id || id.length < 8 || id.length > 128) return null
  return id
}

export async function GET(req: Request, ctx: Ctx) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ error: 'Neon não configurado.', configured: false }, { status: 503 })
  }

  const { domain } = await ctx.params
  if (!isNeonSyncDomain(domain)) {
    return NextResponse.json({ error: 'Domínio inválido.' }, { status: 400 })
  }

  const userId = userIdFrom(req)
  if (!userId) {
    return NextResponse.json({ error: 'ID de dispositivo em falta.' }, { status: 400 })
  }

  try {
    await ensureNeonSchema()
    const sql = getNeonSql()
    const rows = await sql`
      SELECT payload, updated_at
      FROM yieldscan_sync
      WHERE user_id = ${userId} AND domain = ${domain}
      LIMIT 1
    `
    const row = rows[0] as { payload: unknown; updated_at: string | Date } | undefined
    if (!row) {
      return NextResponse.json({ payload: null, updatedAt: null, configured: true })
    }
    const updatedAt =
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)
    return NextResponse.json({ payload: row.payload, updatedAt, configured: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro Neon'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ error: 'Neon não configurado.', configured: false }, { status: 503 })
  }

  const { domain } = await ctx.params
  if (!isNeonSyncDomain(domain)) {
    return NextResponse.json({ error: 'Domínio inválido.' }, { status: 400 })
  }

  const userId = userIdFrom(req)
  if (!userId) {
    return NextResponse.json({ error: 'ID de dispositivo em falta.' }, { status: 400 })
  }

  let body: { payload?: unknown; clientUpdatedAt?: string | null }
  try {
    body = (await req.json()) as { payload?: unknown; clientUpdatedAt?: string | null }
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  if (body.payload === undefined) {
    return NextResponse.json({ error: 'Payload em falta.' }, { status: 400 })
  }

  try {
    await ensureNeonSchema()
    const sql = getNeonSql()

    if (body.clientUpdatedAt) {
      const existing = await sql`
        SELECT updated_at FROM yieldscan_sync
        WHERE user_id = ${userId} AND domain = ${domain}
        LIMIT 1
      `
      const row = existing[0] as { updated_at: string | Date } | undefined
      if (row) {
        const remoteMs = new Date(row.updated_at).getTime()
        const clientMs = new Date(body.clientUpdatedAt).getTime()
        if (Number.isFinite(remoteMs) && Number.isFinite(clientMs) && remoteMs > clientMs) {
          return NextResponse.json(
            { error: 'Dados na nuvem mais recentes. Faça pull primeiro.', conflict: true },
            { status: 409 },
          )
        }
      }
    }

    const payloadJson = JSON.stringify(body.payload)
    await sql`
      INSERT INTO yieldscan_sync (user_id, domain, payload, updated_at)
      VALUES (${userId}, ${domain}, ${payloadJson}::jsonb, NOW())
      ON CONFLICT (user_id, domain)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `

    const rows = await sql`
      SELECT updated_at FROM yieldscan_sync
      WHERE user_id = ${userId} AND domain = ${domain}
      LIMIT 1
    `
    const updated = rows[0] as { updated_at: string | Date }
    const updatedAt =
      updated.updated_at instanceof Date ? updated.updated_at.toISOString() : String(updated.updated_at)

    return NextResponse.json({ ok: true, updatedAt, configured: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro Neon'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
