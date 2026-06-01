/**
 * GNews API v4 — search (geral). Chave: GNEWS_API_KEY
 * https://gnews.io/
 */

import type { NewsDataArticle } from '@/lib/newsdata'

const GNEWS_SEARCH = 'https://gnews.io/api/v4/search'

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return String(v).trim()
}

function hashId(link: string): string {
  let h = 0
  for (let i = 0; i < link.length; i++) h = (Math.imul(31, h) + link.charCodeAt(i)) | 0
  return `${h >>> 0}`
}

function mapArticle(raw: Record<string, unknown>): NewsDataArticle | null {
  const title = str(raw.title)
  const link = str(raw.url)
  if (!title || !link) return null

  const source = asRecord(raw.source)
  const sourceName = source ? str(source.name) : ''
  const sourceUrl = source ? str(source.url) : ''

  const published = str(raw.publishedAt) || null
  const desc = str(raw.description) || str(raw.content) || null
  const image = str(raw.image) || null

  return {
    article_id: `gnews-${hashId(link)}`,
    title,
    link,
    description: desc,
    content: desc,
    pubDate: published,
    source_id: sourceUrl || 'gnews',
    source_name: sourceName || 'GNews',
    source_priority: null,
    category: null,
    country: null,
    language: 'pt',
    keywords: null,
    image_url: image,
  }
}

/**
 * Notícias gerais (PT). Sem chave ou erro de rede devolve array vazio.
 */
export async function fetchGnewsAsArticles(): Promise<NewsDataArticle[]> {
  const token = process.env.GNEWS_API_KEY?.trim()
  if (!token) return []

  const q = 'criptomoeda OR bitcoin OR ethereum OR cripto OR inteligencia artificial OR economia OR geopolitica'
  const url = new URL(GNEWS_SEARCH)
  url.searchParams.set('q', q)
  url.searchParams.set('lang', 'pt')
  url.searchParams.set('country', 'pt')
  /** Mais recentes primeiro (default da API é relevance → artigos velhos populares no topo). */
  url.searchParams.set('sortby', 'publishedAt')
  url.searchParams.set('max', '25')
  url.searchParams.set('token', token)

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12_000)
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      })
      const data: unknown = await res.json().catch(() => null)
      const rec = asRecord(data)
      if (!rec) return []

      const articles = rec.articles
      if (!Array.isArray(articles)) return []

      const out: NewsDataArticle[] = []
      for (const item of articles) {
        const r = asRecord(item)
        if (!r) continue
        const mapped = mapArticle(r)
        if (mapped) out.push(mapped)
      }
      return out
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return []
  }
}

/** Notícias de bolsa americana (EN + PT). */
export async function fetchGnewsStocksAsArticles(): Promise<NewsDataArticle[]> {
  const token = process.env.GNEWS_API_KEY?.trim()
  if (!token) return []

  const q =
    'NASDAQ OR NYSE OR "stock market" OR earnings OR NVIDIA OR Apple OR Microsoft OR Tesla OR "Wall Street" OR "S&P 500"'
  const url = new URL(GNEWS_SEARCH)
  url.searchParams.set('q', q)
  url.searchParams.set('lang', 'en')
  url.searchParams.set('sortby', 'publishedAt')
  url.searchParams.set('max', '20')
  url.searchParams.set('token', token)

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12_000)
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      })
      const data: unknown = await res.json().catch(() => null)
      const rec = asRecord(data)
      if (!rec) return []

      const articles = rec.articles
      if (!Array.isArray(articles)) return []

      const out: NewsDataArticle[] = []
      for (const item of articles) {
        const r = asRecord(item)
        if (!r) continue
        const mapped = mapArticle(r)
        if (!mapped) continue
        out.push({
          ...mapped,
          article_id: `gnews-stocks-${mapped.article_id ?? hashId(mapped.link ?? '')}`,
        })
      }
      return out
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return []
  }
}
