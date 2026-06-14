/**
 * CoinGecko no servidor (rotas /api/coingecko/*).
 * Chaves opcionais aumentam o limite e reduzem 429 no calculador.
 *
 * Pro: https://pro-api.coingecko.com + header x-cg-pro-api-key
 * Demo: https://api.coingecko.com + header x-cg-demo-api-key
 *
 * Se a chave estiver inválida (401), tenta automaticamente o tier seguinte
 * (demo → API pública) para não quebrar o mobile.
 */

export type CoingeckoTierId = 'pro' | 'demo' | 'public'

export type CoingeckoTier = {
  id: CoingeckoTierId
  base: string
  headers: Record<string, string>
}

const PUBLIC_BASE = 'https://api.coingecko.com/api/v3'

/** 401/403 = chave errada, expirada ou no env errado. */
export function isCoingeckoAuthError(status: number): boolean {
  return status === 401 || status === 403
}

/** Lista de tiers por ordem de tentativa (Pro → Demo → público). */
export function getCoingeckoTiers(): CoingeckoTier[] {
  const tiers: CoingeckoTier[] = []
  const pro = process.env.COINGECKO_PRO_API_KEY?.trim()
  const demo = process.env.COINGECKO_DEMO_API_KEY?.trim()

  if (pro) {
    tiers.push({
      id: 'pro',
      base: 'https://pro-api.coingecko.com/api/v3',
      headers: {
        Accept: 'application/json',
        'x-cg-pro-api-key': pro,
      },
    })
  }
  if (demo) {
    tiers.push({
      id: 'demo',
      base: PUBLIC_BASE,
      headers: {
        Accept: 'application/json',
        'x-cg-demo-api-key': demo,
      },
    })
  }
  tiers.push({
    id: 'public',
    base: PUBLIC_BASE,
    headers: { Accept: 'application/json' },
  })
  return tiers
}

/** Primeiro tier configurado (compatível com código legado). */
export function getCoingeckoRequestParts(): {
  base: string
  headers: Record<string, string>
} {
  const tier = getCoingeckoTiers()[0]!
  return { base: tier.base, headers: tier.headers }
}

function normalizeCoingeckoPath(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http')) {
    try {
      const u = new URL(pathOrUrl)
      const p = u.pathname
      return p.startsWith('/api/v3') ? p.slice('/api/v3'.length) || '/' : p
    } catch {
      return pathOrUrl
    }
  }
  return pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
}

export type FetchCoingeckoOptions = RequestInit & {
  timeoutMs?: number
  /** Cabeçalhos extra (ex.: User-Agent). */
  extraHeaders?: Record<string, string>
}

/**
 * Pedido CoinGecko com fallback automático em 401/403.
 * 429 não muda de tier — significa limite, não chave inválida.
 */
export async function fetchCoingecko(
  pathOrUrl: string,
  opts: FetchCoingeckoOptions = {},
): Promise<Response> {
  const path = normalizeCoingeckoPath(pathOrUrl)
  const tiers = getCoingeckoTiers()
  const { timeoutMs = 15_000, extraHeaders, ...init } = opts
  let lastRes: Response | null = null

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]!
    const url = `${tier.base}${path}`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        ...init,
        method: init.method ?? 'GET',
        headers: {
          ...extraHeaders,
          ...tier.headers,
          ...(init.headers as Record<string, string> | undefined),
        },
        cache: init.cache ?? 'no-store',
        signal: init.signal ?? ctrl.signal,
      })
      lastRes = res

      if (isCoingeckoAuthError(res.status) && i < tiers.length - 1) {
        continue
      }
      return res
    } catch {
      if (i < tiers.length - 1) continue
    } finally {
      clearTimeout(timer)
    }
  }

  return (
    lastRes ??
    new Response(JSON.stringify({ error: 'CoinGecko indisponível' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}
