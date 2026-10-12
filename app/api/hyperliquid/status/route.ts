import { LIVE_TRADING_LOCKED, STRATEGY_RULES_VERSION } from '@/lib/hyperliquid/constants'
import { NextResponse } from 'next/server'

/** Estado público. Não devolve segredos nem chaves. */
export async function GET() {
  return NextResponse.json({
    network: 'testnet',
    liveTradingLocked: LIVE_TRADING_LOCKED,
    execution: 'paper',
    rulesVersion: STRATEGY_RULES_VERSION,
    rabbySeedCollected: false,
    privateKeyInBrowser: false,
    withdrawEnabled: false,
  })
}
