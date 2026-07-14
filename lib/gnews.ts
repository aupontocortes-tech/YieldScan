/**
 * GNews API v4 — search (geral). Chave: GNEWS_API_KEY
 * https://gnews.io/
 */

import type { NewsDataArticle } from '@/lib/news-article'

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

type GnewsSearchOpts = {
  lang: 'pt' | 'en'
  country?: string
  max: number
  mark: 'crypto' | 'stocks'
}

async function fetchGnewsSearch(token: string, q: string, opts: GnewsSearchOpts): Promise<NewsDataArticle[]> {
  const url = new URL(GNEWS_SEARCH)
  url.searchParams.set('q', q)
  url.searchParams.set('lang', opts.lang)
  if (opts.country) url.searchParams.set('country', opts.country)
  url.searchParams.set('sortby', 'publishedAt')
  url.searchParams.set('max', String(opts.max))
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
        if (opts.mark === 'crypto') {
          out.push({
            ...mapped,
            language: opts.lang === 'pt' ? 'pt' : 'en',
            category: ['crypto'],
            _yieldscanCryptoQuery: true,
          })
        } else {
          out.push({
            ...mapped,
            language: 'en',
            category: ['stocks'],
            article_id: `gnews-stocks-${mapped.article_id ?? hashId(mapped.link ?? '')}`,
            _yieldscanStocksQuery: true,
          })
        }
      }
      return out
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return []
  }
}

function dedupeByLink(lists: NewsDataArticle[][]): NewsDataArticle[] {
  const seen = new Set<string>()
  const out: NewsDataArticle[] = []
  for (const list of lists) {
    for (const a of list) {
      const key = (a.link ?? '').trim().toLowerCase() || (a.title ?? '').trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(a)
    }
  }
  return out
}

/**
 * Notícias de cripto (PT) — várias queries em paralelo para não ficar só Bitcoin.
 * Sem chave ou erro de rede devolve array vazio.
 */
export async function fetchGnewsAsArticles(): Promise<NewsDataArticle[]> {
  const token = process.env.GNEWS_API_KEY?.trim()
  if (!token) return []

  const queries = [
    'bitcoin OR btc',
    'ethereum OR eth OR ether',
    'solana OR xrp OR cardano OR avalanche OR dogecoin OR ripple',
    'criptomoeda OR "mercado cripto" OR defi OR blockchain',
  ]

  const batches = await Promise.all(
    queries.map((q) =>
      fetchGnewsSearch(token, q, { lang: 'pt', country: 'br', max: 10, mark: 'crypto' }),
    ),
  )
  return dedupeByLink(batches).slice(0, 40)
}

/** Notícias de bolsa americana — queries por tema para diversificar além de índices. */
export async function fetchGnewsStocksAsArticles(): Promise<NewsDataArticle[]> {
  const token = process.env.GNEWS_API_KEY?.trim()
  if (!token) return []

  const queries = [
    'NVIDIA OR AMD OR Broadcom OR semiconductor',
    'Apple OR Microsoft OR Google OR Amazon OR Meta',
    'Tesla OR Netflix OR Coinbase OR Palantir',
    'NASDAQ OR "S&P 500" OR earnings OR "Wall Street"',
  ]

  const batches = await Promise.all(
    queries.map((q) => fetchGnewsSearch(token, q, { lang: 'en', max: 8, mark: 'stocks' })),
  )
  return dedupeByLink(batches).slice(0, 32)
}
