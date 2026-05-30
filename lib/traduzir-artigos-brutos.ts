import type { NewsDataArticle } from '@/lib/newsdata'
import { pareceIngles, parecePortugues } from '@/lib/news-lang'
import { traduzirParaPortugues } from '@/lib/translate'

const LOTE_PARALELO = 4

async function traduzirCampos(a: NewsDataArticle): Promise<NewsDataArticle> {
  const rawTitle = String(a.title ?? '').trim()
  const rawDesc = String(a.description ?? a.content ?? rawTitle).trim()
  if (!rawTitle) return a

  if (parecePortugues(`${rawTitle} ${rawDesc}`)) {
    return { ...a, language: 'pt' }
  }

  let title = await traduzirParaPortugues(rawTitle, 'en')
  let desc = await traduzirParaPortugues(rawDesc || rawTitle, 'en')

  if (pareceIngles(title)) title = await traduzirParaPortugues(rawTitle, 'auto')
  if (pareceIngles(desc)) desc = await traduzirParaPortugues(rawDesc || rawTitle, 'auto')

  return {
    ...a,
    title,
    description: desc,
    content: desc,
    language: 'pt',
  }
}

/** Traduz títulos/resumos (CoinDesk, cryptocurrency.cv, etc.) para português — usado em Tendências. */
export async function traduzirArtigosBrutos(
  articles: NewsDataArticle[],
  limit = 50,
): Promise<NewsDataArticle[]> {
  if (!articles.length) return articles

  const copy = [...articles]
  const n = Math.min(limit, copy.length)
  const indices: number[] = []

  for (let i = 0; i < n; i++) {
    const bloco = `${copy[i].title ?? ''} ${copy[i].description ?? ''}`
    if (parecePortugues(bloco)) {
      copy[i] = { ...copy[i], language: 'pt' }
    } else {
      indices.push(i)
    }
  }

  for (let b = 0; b < indices.length; b += LOTE_PARALELO) {
    const chunk = indices.slice(b, b + LOTE_PARALELO)
    if (b > 0) await new Promise((r) => setTimeout(r, 100))
    const traduzidos = await Promise.all(chunk.map((i) => traduzirCampos(copy[i])))
    for (let j = 0; j < chunk.length; j++) {
      copy[chunk[j]] = traduzidos[j]
    }
  }

  return copy
}
