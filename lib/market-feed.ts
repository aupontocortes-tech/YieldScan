import type { NoticiaProcessada } from '@/lib/newsdata'
import { stableNewsSpeechId } from '@/lib/news/news-speech-id'

export type ItemFeedNoticia = {
  id: string
  ordenadoEm: string
  dados: NoticiaProcessada
}

/**
 * Converte para itens de feed mantendo a ordem do array (já curada: score → data no servidor).
 * `id` = ID estável (URL / hash título+fonte) para TTS e SQLite.
 */
export function noticiasParaFeed(noticias: NoticiaProcessada[]): ItemFeedNoticia[] {
  return noticias.map((n) => ({
    id: stableNewsSpeechId(n),
    ordenadoEm: n.dataPublicacao ?? '',
    dados: n,
  }))
}
