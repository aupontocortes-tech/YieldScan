import type { NewsDataArticle } from '@/lib/news-article'
import { pareceIngles } from '@/lib/news-lang'
import {
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

function extractSymbols(text: string): string[] {
  const set = new Set<string>()
  for (const m of text.match(SYMBOL_FROM_NEWS) ?? []) {
    set.add(m.toUpperCase())
  }
  return [...set]
}

function extractStockSymbols(text: string): string[] {
  const set = new Set<string>()
  for (const m of text.match(STOCK_SYMBOL_FROM_NEWS) ?? []) {
    set.add(m.toUpperCase())
  }
  for (const [pattern, ticker] of STOCK_NAME_TO_TICKER) {
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

export function processTrimNewsArticles(articles: NewsDataArticle[]): TrimNewsArticle[] {
  const out: TrimNewsArticle[] = []
  const seen = new Set<string>()

  for (const a of articles) {
    const title = (a.title ?? '').trim()
    const link = (a.link ?? '').trim()
    if (!title || title.length < 8) continue
    if (seen.has(link)) continue
    seen.add(link)

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

    const bloc = `${title} ${summary}`
    out.push({
      title,
      summary: summary.slice(0, 320),
      link: link || '#',
      source: (a.source_name ?? 'cryptocurrency.cv').trim(),
      pubDate: a.pubDate ?? null,
      text,
      sentiment: finalSentiment,
      sentimentScore: finalScore,
      symbols: extractSymbols(bloc),
      stockSymbols: extractStockSymbols(bloc),
    })
  }

  return out.slice(0, 50)
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
  let positivo = 0
  let neutro = 0
  let negativo = 0
  const tokenMentions = new Map<string, number>()
  const tokenNewsScore = new Map<string, number>()

  for (const a of articles) {
    if (a.sentiment === 'POSITIVO') positivo++
    else if (a.sentiment === 'NEGATIVO') negativo++
    else neutro++

    for (const sym of a.symbols) {
      const prev = tokenNewsScore.get(sym) ?? 50
      tokenNewsScore.set(sym, clamp((prev + a.sentimentScore) / 2, 0, 100))
    }
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

  const ptArticles = articles.filter((a) => !pareceIngles(a.title))

  const headlines: TendenciasNewsHeadline[] = ptArticles
    .map((a) => ({
      titulo: a.title,
      impacto: a.sentiment,
      categoria: 'CRIPTO',
      link: a.link,
      sentiment: a.sentiment === 'POSITIVO' ? 'optimista' : a.sentiment === 'NEGATIVO' ? 'pessimista' : 'neutro',
      relevance: clamp(a.sentimentScore, 0, 100),
      intensity: clamp(
        (a.symbols.length + a.stockSymbols.length) * 20 + (a.sentiment !== 'NEUTRO' ? 15 : 0),
        0,
        100,
      ),
      mentionCount: a.symbols.length + a.stockSymbols.length,
      symbols: a.symbols,
      stockSymbols: a.stockSymbols,
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 40)

  /** Top cripto e ações — todas as manchetes PT (até expandir para 20 na UI). */
  const cryptoMentions = new Map<string, number>()
  const stockMentions = new Map<string, number>()
  for (const a of ptArticles) {
    for (const sym of a.symbols) {
      cryptoMentions.set(sym, (cryptoMentions.get(sym) ?? 0) + 1)
    }
    for (const sym of a.stockSymbols) {
      stockMentions.set(sym, (stockMentions.get(sym) ?? 0) + 1)
    }
  }
  const topCryptoMentions = topMentionList(cryptoMentions, 20)
  const topStockMentions = topMentionList(stockMentions, 20)

  for (const h of headlines) {
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
