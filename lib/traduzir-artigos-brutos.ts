import type { NewsDataArticle } from '@/lib/newsdata'
import { parecePortugues } from '@/lib/news-lang'
import { traduzirParaPortugues } from '@/lib/translate'

/** Traduz títulos/resumos de artigos brutos (CoinDesk, CryptoPanic, etc.) para português. */
export async function traduzirArtigosBrutos(
  articles: NewsDataArticle[],
  limit = 20,
): Promise<NewsDataArticle[]> {
  if (!articles.length) return articles
  const copy = [...articles]
  const n = Math.min(limit, copy.length)

  await Promise.all(
    Array.from({ length: n }, (_, i) => (async () => {
      const a = copy[i]
      const bloco = `${a.title ?? ''} ${a.description ?? ''}`
      if (parecePortugues(bloco)) {
        copy[i] = { ...a, language: 'pt' }
        return
      }
      const title = await traduzirParaPortugues(String(a.title ?? ''), 'en')
      const desc = await traduzirParaPortugues(
        String(a.description ?? a.content ?? title),
        'en',
      )
      copy[i] = { ...a, title, description: desc, content: desc, language: 'pt' }
    })()),
  )

  return copy
}
