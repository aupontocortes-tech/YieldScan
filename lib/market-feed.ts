import type { NoticiaProcessada } from '@/lib/newsdata'

export type ItemFeedNoticia = {
  id: string
  ordenadoEm: string
  dados: NoticiaProcessada
}

/**
 * Converte para itens de feed mantendo a ordem do array (já curada: score → data no servidor).
 */
export function noticiasParaFeed(noticias: NoticiaProcessada[]): ItemFeedNoticia[] {
  return noticias.map((n) => ({
    id: `n-${n.articleId ?? n.link}`,
    ordenadoEm: n.dataPublicacao ?? '',
    dados: n,
  }))
}
