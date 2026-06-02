import type { TendenciasApiResponse, TendenciasPrefs } from '@/lib/tendencias/types'

export async function fetchTendenciasClient(
  prefs: TendenciasPrefs,
  options?: { refresh?: boolean },
): Promise<TendenciasApiResponse> {
  const refresh = options?.refresh === true
  const q = new URLSearchParams({
    period: prefs.momentumPeriod,
    tone: prefs.analysisTone,
  })
  if (refresh) q.set('refresh', '1')
  const res = await fetch(`/api/tendencias?${q}`, {
    cache: refresh ? 'no-store' : 'default',
  })
  if (!res.ok) throw new Error('Falha ao carregar tendências')
  return res.json() as Promise<TendenciasApiResponse>
}
