import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function set(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

/**
 * GET — confirma se o servidor Vercel “vê” variáveis de RPC (sem expor URLs nem chaves).
 * Abre no browser: /api/liquidity/diagnostics
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    solana: {
      SOLANA_RPC_URL: set('SOLANA_RPC_URL'),
      HELIUS_RPC_URL: set('HELIUS_RPC_URL'),
      NEXT_PUBLIC_SOLANA_RPC_URL: set('NEXT_PUBLIC_SOLANA_RPC_URL'),
    },
    evm: {
      ETH_RPC_URL: set('ETH_RPC_URL') || set('NEXT_PUBLIC_ETH_RPC_URL'),
      ARBITRUM_RPC_URL: set('ARBITRUM_RPC_URL') || set('NEXT_PUBLIC_ARBITRUM_RPC_URL'),
      BASE_RPC_URL: set('BASE_RPC_URL') || set('NEXT_PUBLIC_BASE_RPC_URL'),
      POLYGON_RPC_URL: set('POLYGON_RPC_URL') || set('NEXT_PUBLIC_POLYGON_RPC_URL'),
      BSC_RPC_URL:
        set('BSC_RPC_URL') || set('BNB_RPC_URL') || set('NEXT_PUBLIC_BSC_RPC_URL'),
    },
    hint:
      'Se algum campo for false, a variável não está disponível neste deployment (nome errado, só Preview, ou falta redeploy).',
  })
}
