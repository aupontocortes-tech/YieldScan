import type { BinanceInterval, OhlcvBar } from '@/lib/btc/types'

export async function fetchBtcKlines(
  interval: BinanceInterval,
  limit = 500
): Promise<OhlcvBar[]> {
  const q = new URLSearchParams({ interval, limit: String(limit) })
  const res = await fetch(`/api/btc-klines?${q}`)
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (!res.ok) {
    const msg =
      body &&
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Pedido falhou (${res.status})`
    throw new Error(msg)
  }
  const raw = body
  if (!Array.isArray(raw)) throw new Error('Resposta inválida do servidor (não são velas).')
  return parseBinanceKlines(raw)
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
