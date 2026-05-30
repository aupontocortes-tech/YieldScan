import type { NewsDataArticle } from '@/lib/newsdata'

function dedupeKey(a: NewsDataArticle): string {
  const link = (a.link ?? '').trim().toLowerCase()
  if (link && link !== '#') return link
  return (a.title ?? '').trim().toLowerCase()
}

/** Funde fontes de notícias sem duplicar URLs. CoinDesk primeiro (sentimento nativo). */
export function mergeTrimNewsArticles(...lists: NewsDataArticle[][]): NewsDataArticle[] {
  const seen = new Set<string>()
  const out: NewsDataArticle[] = []

  for (const list of lists) {
    for (const a of list) {
      const key = dedupeKey(a)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(a)
    }
  }

  return out.slice(0, 100)
}
