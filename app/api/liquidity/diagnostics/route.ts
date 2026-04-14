import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Probe = {
  configured: boolean
  ok: boolean
  status: 'ok' | 'not_configured' | 'failed'
  detail?: string
}

function pickEnv(...names: string[]): string | null {
  for (const n of names) {
    const v = process.env[n]?.trim()
    if (v) return v
  }
  return null
}

async function probeEvmRpc(url: string | null): Promise<Probe> {
  if (!url) return { configured: false, ok: false, status: 'not_configured' }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      cache: 'no-store',
    })
    const data = (await res.json()) as { result?: string; error?: { message?: string } }
    if (!res.ok) {
      return {
        configured: true,
        ok: false,
        status: 'failed',
        detail: `http_${res.status}`,
      }
    }
    if (typeof data.result === 'string' && data.result.startsWith('0x')) {
      return { configured: true, ok: true, status: 'ok' }
    }
    return {
      configured: true,
      ok: false,
      status: 'failed',
      detail: data.error?.message || 'invalid_rpc_response',
    }
  } catch (e) {
    return {
      configured: true,
      ok: false,
      status: 'failed',
      detail: e instanceof Error ? e.message : 'network_error',
    }
  }
}

async function probeSolanaRpc(url: string | null): Promise<Probe> {
  if (!url) return { configured: false, ok: false, status: 'not_configured' }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth', params: [] }),
      cache: 'no-store',
    })
    const data = (await res.json()) as { result?: string; error?: { message?: string } }
    if (!res.ok) {
      return { configured: true, ok: false, status: 'failed', detail: `http_${res.status}` }
    }
    if (String(data.result || '').toLowerCase() === 'ok') {
      return { configured: true, ok: true, status: 'ok' }
    }
    return {
      configured: true,
      ok: false,
      status: 'failed',
      detail: data.error?.message || 'invalid_rpc_response',
    }
  } catch (e) {
    return {
      configured: true,
      ok: false,
      status: 'failed',
      detail: e instanceof Error ? e.message : 'network_error',
    }
  }
}

/**
 * GET — confirma se o servidor Vercel “vê” variáveis de RPC (sem expor URLs nem chaves).
 * Abre no browser: /api/liquidity/diagnostics
 */
export async function GET() {
  const ethUrl = pickEnv('ETH_RPC_URL', 'NEXT_PUBLIC_ETH_RPC_URL', 'ETHEREUM_RPC_URL')
  const arbUrl = pickEnv('ARBITRUM_RPC_URL', 'NEXT_PUBLIC_ARBITRUM_RPC_URL', 'ARB_RPC_URL')
  const baseUrl = pickEnv('BASE_RPC_URL', 'NEXT_PUBLIC_BASE_RPC_URL', 'BASE_MAINNET_RPC_URL')
  const polygonUrl = pickEnv(
    'POLYGON_RPC_URL',
    'NEXT_PUBLIC_POLYGON_RPC_URL',
    'MATIC_RPC_URL',
    'POLYGON_MAINNET_RPC_URL',
  )
  const bscUrl = pickEnv('BSC_RPC_URL', 'BNB_RPC_URL', 'NEXT_PUBLIC_BSC_RPC_URL')
  const solUrl = pickEnv('SOLANA_RPC_URL', 'HELIUS_RPC_URL', 'NEXT_PUBLIC_SOLANA_RPC_URL')

  const [eth, arbitrum, base, polygon, bsc, solana] = await Promise.all([
    probeEvmRpc(ethUrl),
    probeEvmRpc(arbUrl),
    probeEvmRpc(baseUrl),
    probeEvmRpc(polygonUrl),
    probeEvmRpc(bscUrl),
    probeSolanaRpc(solUrl),
  ])

  return NextResponse.json({
    ok: eth.ok || arbitrum.ok || base.ok || polygon.ok || bsc.ok || solana.ok,
    evm: { eth, arbitrum, base, polygon, bsc },
    solana,
    hint:
      'Diagnóstico sem expor URLs/chaves. Se status=failed: URL/rede/chave/rate-limit. Se not_configured: variável ausente neste deployment.',
  })
}
