/**
 * Fonte complementar para o filtro «IA»: RSS públicos (sem chave).
 * A NewsData.io gratuita muitas vezes não devolve linhas suficientes para queries só de IA.
 */

import type { NewsDataArticle } from '@/lib/newsdata'
import {
  normalizarTextoParaClassificacaoIa,
  textoIndicaFocoInteligenciaArtificial,
} from '@/lib/news-ia-strict'

const UA = 'YieldScan/1 (news aggregator; IA RSS)'

const FEEDS_IA = [
  {
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    sourceName: 'TechCrunch',
  },
  {
    url: 'https://www.wired.com/feed/tag/ai/latest/rss',
    sourceName: 'Wired',
  },
] as const

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function unwrapCdata(s: string): string {
  const t = s.trim()
  const m = t.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i)
  return (m ? m[1] : t).trim()
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = block.match(re)
  if (!m) return ''
  let inner = m[1].trim()
  inner = unwrapCdata(inner)
  return stripTags(inner)
}

function hashId(link: string): string {
  let h = 0
  for (let i = 0; i < link.length; i++) h = (Math.imul(31, h) + link.charCodeAt(i)) | 0
  return `yieldscan-ai-rss-${(h >>> 0).toString(36)}`
}

function parseRssItems(xml: string): { title: string; link: string; description: string; pubDate: string }[] {
  const items: { title: string; link: string; description: string; pubDate: string }[] = []
  const re = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const block = m[1]
    const title = extractTag(block, 'title')
    const link = extractTag(block, 'link')
    let description = extractTag(block, 'description')
    if (!description) description = extractTag(block, 'content:encoded')
    const pubRaw = extractTag(block, 'pubDate')
    if (!title || !link) continue
    items.push({ title, link, description, pubDate: pubRaw })
  }
  return items
}

async function fetchXml(url: string, timeoutMs: number): Promise<string | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': UA },
      cache: 'no-store',
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

function toPubDateIso(pub: string): string | null {
  if (!pub.trim()) return null
  const d = new Date(pub)
  if (!Number.isFinite(d.getTime())) return null
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

/**
 * Artigos de feeds RSS dedicados a IA → mesmo formato NewsData + flag de classificação.
 */
export async function fetchAiNewsFromRssFeeds(opts?: { maxPerFeed?: number; timeoutMs?: number }): Promise<
  NewsDataArticle[]
> {
  const maxPerFeed = opts?.maxPerFeed ?? 18
  const timeoutMs = opts?.timeoutMs ?? 12_000
  const out: NewsDataArticle[] = []
  const seen = new Set<string>()

  for (const { url, sourceName } of FEEDS_IA) {
    const xml = await fetchXml(url, timeoutMs)
    if (!xml) continue
    const items = parseRssItems(xml).slice(0, maxPerFeed)
    for (const it of items) {
      const link = it.link.trim()
      if (!link || seen.has(link)) continue
      const blobIa = normalizarTextoParaClassificacaoIa(`${it.title}\n${it.description}`)
      if (!textoIndicaFocoInteligenciaArtificial(blobIa)) continue
      seen.add(link)
      out.push({
        article_id: hashId(link),
        title: it.title,
        link,
        description: it.description || null,
        content: null,
        pubDate: toPubDateIso(it.pubDate),
        source_id: sourceName.toLowerCase().replace(/\s+/g, '-'),
        source_name: `${sourceName} · IA`,
        source_priority: null,
        category: ['technology', 'artificial intelligence'],
        country: null,
        language: 'en',
        keywords: null,
        image_url: null,
        /* Flag aplicado em enrichYieldscanAiFlag só se o texto passar o critério estrito. */
        _yieldscanAiQuery: false,
      })
    }
  }

  return out
}
