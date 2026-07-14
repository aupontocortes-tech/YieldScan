import type { NewsDataArticle } from '@/lib/news-article'
import { pareceIngles } from '@/lib/news-lang'
import {
  CRYPTO_NAME_TO_SYMBOL,
  NEGATIVE_WORDS,
  POSITIVE_WORDS,
  STOCK_NAME_TO_TICKER,
  STOCK_SYMBOL_FROM_NEWS,
  SYMBOL_FROM_NEWS,
  TRIM_NARRATIVE_RULES,
  type TrimNarrativeId,
} from '@/lib/tendencias/trim-config'
import type { SentimentLevel, TendenciasNewsHeadline, TendenciasNewsInsight } from '@/lib/tendencias/types'

export type TrimNewsArticle = {
  title: string
  summary: string
  link: string
  source: string
  pubDate: string | null
  text: string
  sentiment: 'POSITIVO' | 'NEGATIVO' | 'NEUTRO'
  sentimentScore: number
  symbols: string[]
  stockSymbols: string[]
  /** Origem/tema: cripto tem prioridade no feed face a ações. */
  kind: 'crypto' | 'stocks' | 'mixed'
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function scoreTextSentiment(text: string): {
  sentiment: 'POSITIVO' | 'NEGATIVO' | 'NEUTRO'
  score: number
} {
  const pos = (text.match(new RegExp(POSITIVE_WORDS.source, 'gi')) ?? []).length
  const neg = (text.match(new RegExp(NEGATIVE_WORDS.source, 'gi')) ?? []).length
  const raw = 50 + pos * 12 - neg * 14
  const score = clamp(raw, 0, 100)
  if (pos > neg && pos >= 1) return { sentiment: 'POSITIVO', score }
  if (neg > pos && neg >= 1) return { sentiment: 'NEGATIVO', score }
  return { sentiment: 'NEUTRO', score }
}

/** Tickers curtos seguros em minúsculas (evita near→NEAR, sol→SOL, link→LINK). */
const CRYPTO_TICKER_CI =
  /\b(btc|eth|xrp|bnb|doge|avax|dot|matic|uni|aave|arb|pepe|shib|usdt|usdc|ondo|imx|apt|inj|bonk|wif|tao|fet)\b/gi

function extractSymbols(text: string): string[] {
  const set = new Set<string>()
  /** Tickers em MAIÚSCULAS no texto original (NEAR, SOL, LINK, OP…). */
  const upperRe = new RegExp(SYMBOL_FROM_NEWS.source, 'g')
  for (const m of text.match(upperRe) ?? []) {
    set.add(m.toUpperCase())
  }
  for (const m of text.match(CRYPTO_TICKER_CI) ?? []) {
    set.add(m.toUpperCase())
  }
  for (const [pattern, symbol] of CRYPTO_NAME_TO_SYMBOL) {
    pattern.lastIndex = 0
    if (pattern.test(text)) set.add(symbol)
  }
  return [...set]
}

function normalizeHeadlineKey(title: string, link: string): string {
  const t = title.trim().toLowerCase().replace(/\s+/g, ' ')
  if (t.length >= 12) return `t:${t}`
  const l = link.trim().toLowerCase()
  return l && l !== '#' ? `l:${l}` : `t:${t}`
}

function extractStockSymbols(text: string): string[] {
  const set = new Set<string>()
  const tickerRe = new RegExp(STOCK_SYMBOL_FROM_NEWS.source, 'g')
  for (const m of text.match(tickerRe) ?? []) {
    set.add(m.toUpperCase())
  }
  for (const [pattern, ticker] of STOCK_NAME_TO_TICKER) {
    pattern.lastIndex = 0
    if (pattern.test(text)) set.add(ticker)
  }
  return [...set]
}

function topMentionList(map: Map<string, number>, limit = 10) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([symbol, count]) => ({ symbol, count }))
}

function classifyArticleKind(
  a: NewsDataArticle,
  symbols: string[],
  stockSymbols: string[],
  text: string,
): 'crypto' | 'stocks' | 'mixed' {
  if (a._yieldscanStocksQuery && !a._yieldscanCryptoQuery) return 'stocks'
  if (a._yieldscanCryptoQuery) return 'crypto'
  const id = String(a.article_id ?? '')
  if (id.startsWith('coindesk-') || id.startsWith('cryptocv-') || id.startsWith('cryptopanic-') || id.startsWith('gnews-')) {
    if (id.startsWith('gnews-stocks-')) return 'stocks'
    return 'crypto'
  }
  const cryptoHit = symbols.length > 0 || /\b(bitcoin|ethereum|cripto|crypto|blockchain|defi|solana|btc|eth)\b/i.test(text)
  const stockHit = stockSymbols.length > 0
  if (cryptoHit && stockHit) return 'mixed'
  if (stockHit && !cryptoHit) return 'stocks'
  return 'crypto'
}

/** Chave para diversificar o feed (evita 10 manchetes BTC seguidas). */
function primaryMentionKey(symbols: string[], stockSymbols: string[], kind: 'crypto' | 'stocks' | 'mixed'): string {
  if (kind === 'stocks') return stockSymbols[0] ? `s:${stockSymbols[0]}` : 's:geral'
  if (symbols[0]) return `c:${symbols[0]}`
  if (stockSymbols[0]) return `s:${stockSymbols[0]}`
  return kind === 'stocks' ? 's:geral' : 'c:geral'
}

/**
 * Round-robin por símbolo principal + quota cripto/ações.
 * Limita BTC (e outros) a no máximo 3 manchetes no topo do feed.
 */
function balanceHeadlines<
  T extends {
    kind: 'crypto' | 'stocks' | 'mixed'
    relevance: number
    symbols: string[]
    stockSymbols: string[]
  },
>(items: T[], limit = 40): T[] {
  const crypto = items.filter((h) => h.kind !== 'stocks').sort((a, b) => b.relevance - a.relevance)
  const stocks = items.filter((h) => h.kind === 'stocks').sort((a, b) => b.relevance - a.relevance)

  const MAX_PER_KEY = 3
  const cryptoSlots = Math.min(crypto.length, Math.max(24, Math.ceil(limit * 0.65)))
  const stockSlots = Math.min(stocks.length, limit - Math.min(cryptoSlots, crypto.length))

  function takeDiverse(list: T[], slots: number): T[] {
    const buckets = new Map<string, T[]>()
    for (const h of list) {
      const key = primaryMentionKey(h.symbols, h.stockSymbols ?? [], h.kind)
      const arr = buckets.get(key) ?? []
      if (arr.length < MAX_PER_KEY) arr.push(h)
      buckets.set(key, arr)
    }
    const queues = [...buckets.values()]
    const out: T[] = []
    let guard = 0
    while (out.length < slots && queues.some((q) => q.length) && guard < slots * 4) {
      guard++
      for (const q of queues) {
        if (out.length >= slots) break
        const next = q.shift()
        if (next) out.push(next)
      }
    }
    return out
  }

  return [...takeDiverse(crypto, cryptoSlots), ...takeDiverse(stocks, stockSlots)].slice(0, limit)
}

export function processTrimNewsArticles(articles: NewsDataArticle[]): TrimNewsArticle[] {
  const out: TrimNewsArticle[] = []
  const seen = new Set<string>()

  for (const a of articles) {
    const title = (a.title ?? '').trim()
    const link = (a.link ?? '').trim()
    if (!title || title.length < 8) continue
    const key = normalizeHeadlineKey(title, link)
    if (seen.has(key)) continue
    if (link && link !== '#' && seen.has(`l:${link.toLowerCase()}`)) continue
    seen.add(key)
    if (link && link !== '#') seen.add(`l:${link.toLowerCase()}`)

    const summary = stripHtml([a.description, a.content].filter(Boolean).join(' ') || title)
    const text = `${title} ${summary}`.toLowerCase()
    const { sentiment, score } = scoreTextSentiment(text)
    const preset = (a as NewsDataArticle & { _trimSentiment?: string })._trimSentiment
    const finalSentiment =
      preset === 'POSITIVO' || preset === 'NEGATIVO' || preset === 'NEUTRO'
        ? preset
        : sentiment
    const finalScore =
      preset === 'POSITIVO' ? Math.max(score, 65) : preset === 'NEGATIVO' ? Math.min(score, 35) : score

    const bloc = `${title} ${summary} ${(a.keywords ?? []).join(' ')}`
    const symbols = extractSymbols(bloc)
    const stockSymbols = extractStockSymbols(bloc)
    out.push({
      title,
      summary: summary.slice(0, 320),
      link: link || '#',
      source: (a.source_name ?? 'cryptocurrency.cv').trim(),
      pubDate: a.pubDate ?? null,
      text,
      sentiment: finalSentiment,
      sentimentScore: finalScore,
      symbols,
      stockSymbols,
      kind: classifyArticleKind(a, symbols, stockSymbols, text),
    })
  }

  return out.slice(0, 70)
}

export type TrimNarrativeStats = {
  id: TrimNarrativeId
  label: string
  mentionCount: number
  frequency: number
  posCount: number
  negCount: number
  relatedSymbols: string[]
}

export function analyzeTrimNews(articles: TrimNewsArticle[]): {
  insight: TendenciasNewsInsight
  tokenMentions: Map<string, number>
  tokenNewsScore: Map<string, number>
  narratives: TrimNarrativeStats[]
} {
  const tokenMentions = new Map<string, number>()
  const tokenNewsScore = new Map<string, number>()

  for (const a of articles) {
    for (const sym of a.symbols) {
      const prev = tokenNewsScore.get(sym) ?? 50
      tokenNewsScore.set(sym, clamp((prev + a.sentimentScore) / 2, 0, 100))
    }
  }

  /** Contagens da aba Notícias alinham com as manchetes mostradas (PT). */
  const ptArticles = articles.filter((a) => !pareceIngles(a.title))

  /**
   * Top “mais falados”: conta menções em todo o conjunto já curado (inclui títulos
   * traduzidos que ainda “parecem” EN) — senão o ranking ficava vazio com frequência.
   */
  const mentionPool = articles.length ? articles : ptArticles

  let positivo = 0
  let neutro = 0
  let negativo = 0
  for (const a of ptArticles) {
    if (a.sentiment === 'POSITIVO') positivo++
    else if (a.sentiment === 'NEGATIVO') negativo++
    else neutro++
  }

  const narrativeStats: TrimNarrativeStats[] = TRIM_NARRATIVE_RULES.map((rule) => {
    const hits = articles.filter((a) => rule.keywords.test(a.text))
    let posCount = 0
    let negCount = 0
    for (const h of hits) {
      if (h.sentiment === 'POSITIVO') posCount++
      else if (h.sentiment === 'NEGATIVO') negCount++
    }
    return {
      id: rule.id,
      label: rule.label,
      mentionCount: hits.length,
      frequency: articles.length ? hits.length / articles.length : 0,
      posCount,
      negCount,
      relatedSymbols: rule.related,
    }
  })
    .filter((n) => n.mentionCount > 0)
    .sort((a, b) => b.mentionCount - a.mentionCount)

  const toHeadline = (a: TrimNewsArticle) => ({
    titulo: a.title,
    impacto: a.sentiment,
    categoria: a.kind === 'stocks' ? 'ACOES' : 'CRIPTO',
    link: a.link,
    sentiment: (a.sentiment === 'POSITIVO'
      ? 'optimista'
      : a.sentiment === 'NEGATIVO'
        ? 'pessimista'
        : 'neutro') as TendenciasNewsHeadline['sentiment'],
    relevance: clamp(a.sentimentScore, 0, 100),
    intensity: clamp(
      (a.symbols.length + a.stockSymbols.length) * 20 + (a.sentiment !== 'NEUTRO' ? 15 : 0),
      0,
      100,
    ),
    mentionCount: a.symbols.length + a.stockSymbols.length,
    symbols: a.symbols,
    stockSymbols: a.stockSymbols,
    kind: a.kind,
  })

  const allMapped = mentionPool.map(toHeadline)
  /** Pool completo — o filtro da UI pesquisa aqui (não só no slice diversificado). */
  const headlinesAll: TendenciasNewsHeadline[] = allMapped
    .map(({ kind: _kind, ...h }) => h)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 80)

  const headlines: TendenciasNewsHeadline[] = balanceHeadlines(allMapped, 40).map(
    ({ kind: _kind, ...h }) => h,
  )

  /** Top cripto e ações — menções no pool curado (até expandir para 20 na UI). */
  const cryptoMentions = new Map<string, number>()
  const stockMentions = new Map<string, number>()
  for (const a of mentionPool) {
    for (const sym of a.symbols) {
      cryptoMentions.set(sym, (cryptoMentions.get(sym) ?? 0) + 1)
    }
    for (const sym of a.stockSymbols) {
      stockMentions.set(sym, (stockMentions.get(sym) ?? 0) + 1)
    }
  }
  const topCryptoMentions = topMentionList(cryptoMentions, 20)
  const topStockMentions = topMentionList(stockMentions, 20)

  for (const h of headlinesAll) {
    for (const sym of h.symbols) {
      tokenMentions.set(sym, (tokenMentions.get(sym) ?? 0) + 1)
    }
  }

  return {
    insight: {
      positivo,
      neutro,
      negativo,
      topMentions: topCryptoMentions,
      topCryptoMentions,
      topStockMentions,
      dominantNarrative: narrativeStats[0]?.label ?? null,
      headlines,
      headlinesAll,
    },
    tokenMentions,
    tokenNewsScore,
    narratives: narrativeStats,
  }
}

export function newsSentimentToLevel(score: number): SentimentLevel {
  if (score >= 62) return 'optimista'
  if (score <= 38) return 'pessimista'
  return 'neutro'
}
