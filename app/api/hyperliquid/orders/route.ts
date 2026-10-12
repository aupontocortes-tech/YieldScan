import { LIVE_TRADING_LOCKED } from '@/lib/hyperliquid/constants'
import { NextResponse } from 'next/server'

/** Recusa qualquer envio de ordem. A primeira versão não opera dinheiro real nem a testnet ao vivo. */
export async function POST() {
  if (LIVE_TRADING_LOCKED) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Modo real bloqueado. Esta versão só simula. Nenhuma ordem foi enviada.',
      },
      { status: 403 },
    )
  }
  return NextResponse.json({ ok: false, error: 'Executor ainda não ligado.' }, { status: 403 })
}
