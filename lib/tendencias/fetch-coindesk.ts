/**
 * CoinDesk Data / CryptoCompare News — manchetes cripto.
 * Chave: COINDESK_API_KEY (ou CRYPTOCOMPARE_API_KEY como alias)
 * https://developers.coindesk.com
 */

import type { NewsDataArticle } from '@/lib/newsdata'

function coindeskKey(): string {
  return (
    process.env.COINDESK_API_KEY?.trim() ||
    process.env.CRYPTOCOMPARE_API_KEY?.trim() ||
    ''
  )
}

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

function mapSentiment(raw: unknown): 'POSITIVO' | 'NEGATIVO' | 'NEUTRO' | null {
  const s = str(raw).toUpperCase()
  if (s.includes('POSITIVE') || s === 'POS') return 'POSITIVO'
  if (s.includes('NEGATIVE') || s === 'NEG') return 'NEGATIVO'
  if (s.includes('NEUTRAL') || s === 'NEU') return 'NEUTRO'
  return null
}

function mapArticle(raw: Record<string, unknown>): NewsDataArticle | null {
  const title = str(raw.TITLE ?? raw.title)
  const link = str(raw.URL ?? raw.url ?? raw.guid)
  if (!title || title.length < 8) return null

  const publishedOn = num(raw.PUBLISHED_ON ?? raw.published_on)
  const pubDate =
    publishedOn != null
      ? new Date(publishedOn > 1e12 ? publishedOn : publishedOn * 1000).toISOString()
      : str(raw.publishedAt) || null

  const sourceRec = asRecord(raw.SOURCE_DATA) ?? asRecord(raw.source_info)
  const sourceName = str(sourceRec?.NAME ?? sourceRec?.name ?? raw.source) || 'CoinDesk'

  const body = str(raw.BODY ?? raw.body ?? raw.subtitle ?? raw.description)

  const sentiment = mapSentiment(raw.SENTIMENT ?? raw.sentiment)

  const article: NewsDataArticle & { _trimSentiment?: string } = {
    article_id: `coindesk-${hashId(link || title)}`,
    title,
    link: link || '#',
    description: body || title,
    content: body || title,
    pubDate,
    source_id: 'coindesk',
    source_name: sourceName,
    source_priority: null,
    category: ['crypto'],
    country: null,
    language: 'en',
    keywords: null,
    image_url: str(raw.IMAGE_URL ?? raw.imageurl) || null,
    _yieldscanCryptoQuery: true,
  }

  if (sentiment) {
    ;(article as NewsDataArticle & { _trimSentiment?: string })._trimSentiment = sentiment
  }

  return article
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

export async function fetchCoindeskAsArticles(limit = 80): Promise<NewsDataArticle[]> {
  const key = coindeskKey()
  if (!key) return []

  const urls = [
    `https://data-api.coindesk.com/news/v1/article/list?limit=${limit}&lang=EN&api_key=${encodeURIComponent(key)}`,
    `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${encodeURIComponent(key)}`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        next: { revalidate: 120 },
        signal: AbortSignal.timeout(18_000),
        headers: {
          Accept: 'application/json',
          Authorization: `Apikey ${key}`,
        },
      })
      if (!res.ok) continue
      const json: unknown = await res.json()
      const rec = asRecord(json)
      const data = rec?.Data ?? rec?.data
      if (!Array.isArray(data)) continue

      const out: NewsDataArticle[] = []
      for (const item of data) {
        const r = asRecord(item)
        if (!r) continue
        const mapped = mapArticle(r)
        if (mapped) out.push(mapped)
        if (out.length >= limit) break
      }
      if (out.length) return out
    } catch {
      continue
    }
  }

  return []
}
