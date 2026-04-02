/**
 * CryptoPanic — API Developer v2 (notícias cripto).
 * Token: https://cryptopanic.com/developers/api/ → variável CRYPTOPANIC_AUTH_TOKEN
 *
 * Documentação alinhada ao cliente oficial (base URL + /posts/).
 */

import type { NewsDataArticle } from '@/lib/newsdata'

const CRYPTOPANIC_POSTS_URL = 'https://cryptopanic.com/api/developer/v2/posts/'

function tokenCryptopanic(): string {
  return (
    process.env.CRYPTOPANIC_AUTH_TOKEN?.trim() ||
    process.env.CRYPTOPUNK_API_TOKEN?.trim() ||
    ''
  )
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function hashLink(link: string): string {
  let h = 0
  for (let i = 0; i < link.length; i++) h = (Math.imul(31, h) + link.charCodeAt(i)) | 0
  return `${h >>> 0}`
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return String(v).trim()
}

/** Normaliza URL para deduplicação com NewsData. */
export function normalizarLinkDedupe(link: string | null | undefined): string {
  const raw = (link ?? '').trim().toLowerCase()
  if (!raw) return ''
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    u.hash = ''
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.hostname}${path}`
  } catch {
    return raw.split('?')[0].replace(/\/+$/, '')
  }
}

function mapPost(raw: Record<string, unknown>): NewsDataArticle | null {
  const title = str(raw.title)
  if (!title) return null

  const original = str(raw.original_url)
  const panicUrl = str(raw.url)
  const link = original || panicUrl
  if (!link) return null

  const id = raw.id
  const articleId =
    typeof id === 'number' && Number.isFinite(id)
      ? `cryptopanic-${id}`
      : typeof id === 'string' && id
        ? `cryptopanic-${id}`
        : `cryptopanic-${hashLink(link)}`

  const source = asRecord(raw.source)
  const sourceTitle = source ? str(source.title) : ''
  const sourceDomain = source ? str(source.domain) : ''

  const published =
    str(raw.published_at) || str(raw.created_at) || null

  const desc = str(raw.description)
  const image = str(raw.image)

  return {
    article_id: articleId,
    title,
    link,
    description: desc || null,
    content: desc || null,
    pubDate: published,
    source_id: sourceDomain || 'cryptopanic',
    source_name: sourceTitle || sourceDomain || 'CryptoPanic',
    source_priority: null,
    category: ['crypto', 'cryptocurrency'],
    country: null,
    language: source ? str(source.region) || 'en' : 'en',
    keywords: null,
    image_url: image || null,
  }
}

/**
 * Obtém posts (inglês/região configurável) e converte para o formato NewsData usado no pipeline.
 * Sem token ou em erro de rede/API devolve array vazio.
 */
export async function fetchCryptopanicAsNewsDataArticles(): Promise<NewsDataArticle[]> {
  const auth = tokenCryptopanic()
  if (!auth) return []

  const regions = (process.env.CRYPTOPANIC_REGIONS ?? 'en').trim() || 'en'

  const url = new URL(CRYPTOPANIC_POSTS_URL)
  url.searchParams.set('auth_token', auth)
  url.searchParams.set('public', 'true')
  url.searchParams.set('kind', 'news')
  url.searchParams.set('regions', regions)
  const filter = (process.env.CRYPTOPANIC_FILTER ?? 'hot').trim().toLowerCase()
  if (['rising', 'hot', 'bullish', 'bearish', 'important', 'lol'].includes(filter)) {
    url.searchParams.set('filter', filter)
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 22_000)
    try {
      const out: NewsDataArticle[] = []
      let fetchUrl: string | null = url.toString()
      const maxPosts = 40
      const maxPages = 3

      for (let page = 0; page < maxPages && out.length < maxPosts && fetchUrl; page++) {
        const res = await fetch(fetchUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': 'yieldscan-news/1',
          },
          cache: 'no-store',
          signal: controller.signal,
        })
        const data: unknown = await res.json().catch(() => null)
        const rec = asRecord(data)
        if (!rec) break

        if (str(rec.status) === 'api_error') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[cryptopanic]', str(rec.info) || res.status)
          }
          break
        }

        const results = rec.results
        if (!Array.isArray(results)) break

        for (const item of results) {
          const r = asRecord(item)
          if (!r) continue
          const mapped = mapPost(r)
          if (mapped) out.push(mapped)
          if (out.length >= maxPosts) break
        }

        const nextRaw = str(rec.next)
        fetchUrl = nextRaw.startsWith('http')
          ? nextRaw
          : nextRaw.startsWith('/')
            ? `https://cryptopanic.com${nextRaw}`
            : null
      }

      return out
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return []
  }
}

/**
 * Junta listas (ex.: NewsData + CryptoPanic), deduplicando pelo link normalizado.
 * Mantém a primeira ocorrência (prioridade à ordem dos argumentos).
 */
export function mergeArticlesDedupe(
  primary: NewsDataArticle[],
  secondary: NewsDataArticle[]
): NewsDataArticle[] {
  const seen = new Set<string>()
  const out: NewsDataArticle[] = []

  for (const list of [primary, secondary]) {
    for (const a of list) {
      const key = normalizarLinkDedupe(a.link ?? undefined)
      const fallback = (a.article_id ?? a.title ?? '').toLowerCase()
      const k = key || `id:${fallback}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push(a)
    }
  }
  return out
}
