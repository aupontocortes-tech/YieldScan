import type { NoticiaProcessada } from '@/lib/newsdata'

export type ItemFeedNoticia = {
  id: string
  ordenadoEm: string
  dados: NoticiaProcessada
}

function ts(s: string | null | undefined): number {
  if (!s) return 0
  const t = new Date(s.replace(' ', 'T')).getTime()
  return Number.isFinite(t) ? t : 0
}

/** Ordena notícias por data (mais recente primeiro). */
export function noticiasParaFeed(noticias: NoticiaProcessada[]): ItemFeedNoticia[] {
  const items: ItemFeedNoticia[] = noticias.map((n) => ({
    id: `n-${n.articleId ?? n.link}`,
    ordenadoEm: n.dataPublicacao ?? '',
    dados: n,
  }))
  items.sort((a, b) => ts(b.ordenadoEm) - ts(a.ordenadoEm))
  return items
}
