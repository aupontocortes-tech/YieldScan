import type { NoticiaProcessada } from '@/lib/newsdata'
import type { TweetMercadoItem } from '@/lib/twitter-feed'

export type ItemFeedMercado =
  | { tipo: 'noticia'; id: string; ordenadoEm: string; dados: NoticiaProcessada }
  | { tipo: 'tweet'; id: string; ordenadoEm: string; dados: TweetMercadoItem }

function ts(s: string | null | undefined): number {
  if (!s) return 0
  const t = new Date(s.replace(' ', 'T')).getTime()
  return Number.isFinite(t) ? t : 0
}

/** Junta notícias e tweets num único feed ordenado por data (mais recente primeiro). */
export function mergeFeedMercado(
  noticias: NoticiaProcessada[],
  tweets: TweetMercadoItem[]
): ItemFeedMercado[] {
  const items: ItemFeedMercado[] = []
  for (const n of noticias) {
    const id = n.articleId ?? n.link
    items.push({
      tipo: 'noticia',
      id: `n-${id}`,
      ordenadoEm: n.dataPublicacao ?? '',
      dados: n,
    })
  }
  for (const t of tweets) {
    items.push({
      tipo: 'tweet',
      id: `t-${t.id}`,
      ordenadoEm: t.dataPublicacao,
      dados: t,
    })
  }
  items.sort((a, b) => ts(b.ordenadoEm) - ts(a.ordenadoEm))
  return items
}
