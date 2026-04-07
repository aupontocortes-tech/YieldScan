/**
 * Free Crypto News — https://cryptocurrency.cv/api/news
 * Resposta tratada de forma defensiva (estrutura pode variar).
 */

import type { NewsDataArticle } from '@/lib/newsdata'

const CRYPTO_CV_NEWS_URL = 'https://cryptocurrency.cv/api/news'

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

function extrairArrayDoPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  const rec = asRecord(data)
  if (!rec) return []
  const keys = ['data', 'news', 'articles', 'results', 'items', 'posts'] as const
  for (const k of keys) {
    const v = rec[k]
    if (Array.isArray(v)) return v
  }
  return []
}

function primeiroUrl(...cands: string[]): string {
  for (const c of cands) {
    const s = c.trim()
    if (s && /^https?:\/\//i.test(s)) return s
  }
  return ''
}

function mapItem(raw: Record<string, unknown>): NewsDataArticle | null {
  const title =
    str(raw.title) ||
    str(raw.headline) ||
    str(raw.name)
  const link =
    primeiroUrl(
      str(raw.url),
      str(raw.link),
      str(raw.article_url),
      str(recursiveLink(raw))
    )
  if (!title || !link) return null

  const desc =
    str(raw.description) ||
    str(raw.summary) ||
    str(raw.content) ||
    str(raw.body) ||
    null

  const published =
    str(raw.published_at) ||
    str(raw.publishedAt) ||
    str(raw.date) ||
    str(raw.created_at) ||
    str(raw.time) ||
    null

  const source =
    str(raw.source) ||
    str(raw.source_name) ||
    str(raw.site) ||
    'cryptocurrency.cv'

  const image =
    str(raw.image) ||
    str(raw.image_url) ||
    str(raw.thumbnail) ||
    toTextNested(raw, ['imageUrl', 'cover_image', 'coverImage'])

  return {
    article_id: `cryptocv-${hashId(link)}`,
    title,
    link,
    description: desc,
    content: desc,
    pubDate: published,
    source_id: 'cryptocurrency.cv',
    source_name: source,
    source_priority: null,
    category: ['crypto', 'cryptocurrency'],
    country: null,
    language: str(raw.language) || 'en',
    keywords: null,
    image_url: image || null,
    _yieldscanCryptoQuery: true,
  }
}

function recursiveLink(rec: Record<string, unknown>): string {
  const nested = asRecord(rec.source) || asRecord(rec.meta) || asRecord(rec.attributes)
  if (!nested) return ''
  return str(nested.url) || str(nested.link) || ''
}

function toTextNested(rec: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = rec[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

export async function fetchCryptoCvAsArticles(): Promise<NewsDataArticle[]> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12_000)
    try {
      const res = await fetch(CRYPTO_CV_NEWS_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'yieldscan-news/1',
        },
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!res.ok) return []
      const data: unknown = await res.json().catch(() => null)
      const arr = extrairArrayDoPayload(data)
      const out: NewsDataArticle[] = []
      for (const item of arr) {
        const r = asRecord(item)
        if (!r) continue
        const mapped = mapItem(r)
        if (mapped) out.push(mapped)
        if (out.length >= 40) break
      }
      return out
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return []
  }
}
