/** Fetch do feed de notícias no cliente (hub / aba Notícias). */

export type NewsClientPayload = {
  erro?: string
  aviso?: string
  totalResults?: number
  noticias: unknown[]
  feed?: unknown[]
  insights?: unknown[]
}

export async function fetchNoticiasClient(options?: {
  refresh?: boolean
}): Promise<NewsClientPayload> {
  const refresh = options?.refresh === true
  const url = refresh
    ? `/api/news?refresh=1&_=${Date.now()}`
    : '/api/news'
  const res = await fetch(url, {
    cache: refresh ? 'no-store' : 'default',
  })
  const json = (await res.json()) as NewsClientPayload
  if (!res.ok) throw new Error(json.erro ?? 'Erro ao carregar notícias.')
  return json
}
