import type { NewsDataArticle } from '@/lib/news-article'
import { pareceIngles, parecePortugues } from '@/lib/news-lang'
import { traduzirParaPortugues } from '@/lib/translate'

const LOTE_PARALELO = 6

async function traduzirCampos(a: NewsDataArticle): Promise<NewsDataArticle> {
  const rawTitle = String(a.title ?? '').trim()
  const rawDesc = String(a.description ?? a.content ?? rawTitle).trim()
  if (!rawTitle) return a

  const bloco = `${rawTitle} ${rawDesc}`
  const lang = String(a.language ?? '').toLowerCase()
  if (lang.startsWith('pt') || (parecePortugues(bloco) && !pareceIngles(bloco))) {
    return { ...a, language: 'pt' }
  }

  let title = await traduzirParaPortugues(rawTitle, 'en')
  let desc = await traduzirParaPortugues(rawDesc || rawTitle, 'en')
  if (pareceIngles(title)) title = await traduzirParaPortugues(rawTitle, 'auto')
  if (pareceIngles(desc)) desc = await traduzirParaPortugues(rawDesc || rawTitle, 'auto')
  if (pareceIngles(title)) {
    await new Promise((r) => setTimeout(r, 120))
    title = await traduzirParaPortugues(rawTitle, 'en')
  }

  return {
    ...a,
    title,
    description: desc,
    content: desc,
    language: pareceIngles(title) ? a.language : 'pt',
  }
}

/** Mantém só artigos com título já em português (após tradução ou fonte PT). */
export function filtrarArtigosPortuguesParaFeed(articles: NewsDataArticle[]): NewsDataArticle[] {
  return articles.filter((a) => {
    const title = String(a.title ?? '').trim()
    if (!title) return false
    const lang = String(a.language ?? '').toLowerCase()
    /** Fonte GNews / tradução bem-sucedida: confiar no idioma (evita apagar “Bitcoin sobe…”). */
    if (lang.startsWith('pt')) return true
    if (pareceIngles(title)) return false
    const bloco = `${title} ${a.description ?? ''}`
    return parecePortugues(bloco)
  })
}

/** Traduz títulos/resumos (CoinDesk, cryptocurrency.cv, etc.) para português — usado em Tendências. */
export async function traduzirArtigosBrutos(
  articles: NewsDataArticle[],
  limit = 50,
): Promise<NewsDataArticle[]> {
  if (!articles.length) return articles

  const copy = [...articles]
  const cryptoNeed: number[] = []
  const stocksNeed: number[] = []

  for (let i = 0; i < copy.length; i++) {
    const a = copy[i]
    const lang = String(a.language ?? '').toLowerCase()
    const bloco = `${a.title ?? ''} ${a.description ?? ''}`
    if (lang.startsWith('pt') || (parecePortugues(bloco) && !pareceIngles(bloco))) {
      copy[i] = { ...a, language: 'pt' }
      continue
    }
    const id = String(a.article_id ?? '')
    const isStocks =
      Boolean(a._yieldscanStocksQuery) || id.startsWith('gnews-stocks-')
    if (isStocks) stocksNeed.push(i)
    else cryptoNeed.push(i)
  }

  /** Reserva slots: ~70% cripto, resto ações — garante CoinDesk/cv antes da bolsa. */
  const cryptoBudget = Math.min(cryptoNeed.length, Math.max(1, Math.ceil(limit * 0.72)))
  const stocksBudget = Math.min(stocksNeed.length, Math.max(0, limit - cryptoBudget))
  const indices = [...cryptoNeed.slice(0, cryptoBudget), ...stocksNeed.slice(0, stocksBudget)]

  for (let b = 0; b < indices.length; b += LOTE_PARALELO) {
    const chunk = indices.slice(b, b + LOTE_PARALELO)
    if (b > 0) await new Promise((r) => setTimeout(r, 80))
    const traduzidos = await Promise.all(chunk.map((i) => traduzirCampos(copy[i])))
    for (let j = 0; j < chunk.length; j++) {
      copy[chunk[j]] = traduzidos[j]
    }
  }

  return filtrarArtigosPortuguesParaFeed(copy)
}
