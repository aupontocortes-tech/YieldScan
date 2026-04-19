import type { BinanceInterval, OhlcvBar } from '@/lib/btc/types'

async function fetchKlinesFromApi(
  path: string,
  interval: BinanceInterval,
  limit: number,
): Promise<{ ok: boolean; body: unknown; status: number }> {
  const q = new URLSearchParams({ interval, limit: String(limit) })
  const res = await fetch(`${path}?${q}`, { cache: 'no-store', credentials: 'same-origin' })
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { ok: res.ok, body, status: res.status }
}

function errorMessageFromResponse(body: unknown, status: number, path: string): string {
  if (status === 404) return `Rota ${path} não encontrada (404). Verifica o deploy ou usa \`next dev\` / Vercel.`
  const msg =
    body &&
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'string'
      ? (body as { error: string }).error
      : `Pedido falhou (${status})`
  return msg
}

export async function fetchBtcKlines(
  interval: BinanceInterval,
  limit = 500,
): Promise<OhlcvBar[]> {
  const bases = ['/api/btc-klines', '/api/candles/btc']
  let lastErr = 'Sem resposta do servidor'

  for (const path of bases) {
    const { ok, body, status } = await fetchKlinesFromApi(path, interval, limit)
    if (ok && Array.isArray(body)) {
      return parseBinanceKlines(body)
    }
    lastErr = errorMessageFromResponse(body, status, path)
  }

  throw new Error(lastErr)
}

export function parseBinanceKlines(raw: unknown[]): OhlcvBar[] {
  return raw
    .map((row) => {
      if (!Array.isArray(row) || row.length < 6) return null
      const t = Number(row[0])
      if (!Number.isFinite(t)) return null
      return {
        time: Math.floor(t / 1000),
        open: parseFloat(String(row[1])),
        high: parseFloat(String(row[2])),
        low: parseFloat(String(row[3])),
        close: parseFloat(String(row[4])),
        volume: parseFloat(String(row[5])),
      }
    })
    .filter((b): b is OhlcvBar => b != null && Number.isFinite(b.close))
}
