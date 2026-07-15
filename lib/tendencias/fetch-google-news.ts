/**
 * Google News RSS localizado em PT-BR — fallback sem chave para Tendências.
 * Queries separadas evitam que BTC ou índices ocupem todo o ranking.
 */

import type { NewsDataArticle } from '@/lib/news-article'

const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search'
const USER_AGENT = 'YieldScan/1 (market news aggregator)'

type Topic = {
  query: string
  kind: 'crypto' | 'stocks'
  /** Pelo menos um nome deste grupo precisa estar na manchete. */
  required: RegExp
}

const TOPICS: Topic[] = [
  {
    query: '(bitcoin OR BTC OR ethereum OR ether) criptomoeda when:1d',
    kind: 'crypto',
    required: /\b(bitcoin|btc|ethereum|ether|eth)\b/i,
  },
  {
    query: '(solana OR XRP OR ripple) criptomoeda when:1d',
    kind: 'crypto',
    required: /\b(solana|xrp|ripple)\b/i,
  },
  {
    query: '(cardano OR dogecoin OR polkadot) criptomoeda when:1d',
    kind: 'crypto',
    required: /\b(cardano|dogecoin|doge|polkadot)\b/i,
  },
  {
    query: '("BNB Chain" OR "token BNB" OR AVAX OR "Avalanche blockchain") when:1d',
    kind: 'crypto',
    required: /\b(bnb chain|token bnb|avax|avalanche blockchain)\b/i,
  },
  {
    query: '(chainlink OR uniswap OR aave OR SUI) criptomoeda when:1d',
    kind: 'crypto',
    required: /\b(chainlink|uniswap|aave|sui)\b/i,
  },
  {
    query: '(NVIDIA OR AMD OR Broadcom OR Intel) ações when:1d',
    kind: 'stocks',
    required: /\b(nvidia|amd|broadcom|intel)\b/i,
  },
  {
    query: '(Apple OR Microsoft OR Google OR Amazon OR Meta) ações when:1d',
    kind: 'stocks',
    required: /\b(apple|microsoft|google|alphabet|amazon|meta)\b/i,
  },
  {
    query: '(Tesla OR Netflix OR Coinbase OR Palantir) ações when:1d',
    kind: 'stocks',
    required: /\b(tesla|netflix|coinbase|palantir)\b/i,
  },
]

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? decodeXml(match[1]) : ''
}

function hashId(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0
  }
  return `${hash >>> 0}`
}

function feedUrl(query: string): string {
  const url = new URL(GOOGLE_NEWS_RSS)
  url.searchParams.set('q', query)
  url.searchParams.set('hl', 'pt-BR')
  url.searchParams.set('gl', 'BR')
  url.searchParams.set('ceid', 'BR:pt-419')
  return url.toString()
}

async function fetchTopic(topic: Topic, maxItems: number): Promise<NewsDataArticle[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(feedUrl(topic.query), {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml',
        'User-Agent': USER_AGENT,
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) return []

    const xml = await response.text()
    const blocks = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)]
    const out: NewsDataArticle[] = []

    for (const match of blocks) {
      const block = match[1]
      const title = extractTag(block, 'title').replace(/\s+-\s+[^-]{2,60}$/, '').trim()
      const link = extractTag(block, 'link')
      if (!title || !link) continue
      topic.required.lastIndex = 0
      if (!topic.required.test(title)) continue

      const source = extractTag(block, 'source') || 'Google News'
      const pubDateRaw = extractTag(block, 'pubDate')
      const pubDate = pubDateRaw && Number.isFinite(new Date(pubDateRaw).getTime())
        ? new Date(pubDateRaw).toISOString()
        : null

      out.push({
        article_id: `google-news-${topic.kind}-${hashId(link)}`,
        title,
        link,
        description: title,
        content: title,
        pubDate,
        source_id: 'google-news',
        source_name: source,
        source_priority: null,
        category: [topic.kind === 'crypto' ? 'crypto' : 'stocks'],
        country: ['br'],
        language: 'pt',
        keywords: null,
        image_url: null,
        _yieldscanCryptoQuery: topic.kind === 'crypto',
        _yieldscanStocksQuery: topic.kind === 'stocks',
      })

      if (out.length >= maxItems) break
    }
    return out
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

/** Notícias PT-BR das últimas 24h, balanceadas entre cripto e ações US. */
export async function fetchGoogleNewsMarketArticles(): Promise<NewsDataArticle[]> {
  const batches = await Promise.all(TOPICS.map((topic) => fetchTopic(topic, 12)))
  const seen = new Set<string>()
  const out: NewsDataArticle[] = []

  for (const batch of batches) {
    for (const article of batch) {
      const key = (article.title ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(article)
    }
  }

  return out.slice(0, 72)
}
