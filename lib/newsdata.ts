/**
 * NewsData.io — integração server-side.
 * Defina NEWSDATA_API_KEY em `.env.local` (nunca commite a chave).
 *
 * Endpoint pedido pelo produto: https://newsdata.io/api/1/news
 *
 * Notícias cripto extra: CryptoPanic (Developer API v2) — CRYPTOPANIC_AUTH_TOKEN.
 */

import {
  fetchCryptopanicAsNewsDataArticles,
  mergeArticlesDedupe,
} from '@/lib/cryptopanic'

export const NEWSDATA_NEWS_URL = 'https://newsdata.io/api/1/news'

/** Formato de saída padronizado (inteligência de mercado). */
export interface InsightNoticia {
  titulo: string
  resumo: string
  /** Feed de notícias exclusivamente cripto (produto YieldScan). */
  categoria: 'CRIPTO'
  impacto: 'POSITIVO' | 'NEGATIVO' | 'NEUTRO'
  ativos: Array<'BTC' | 'ETH' | 'ALTCOINS' | 'MERCADO GLOBAL'>
  confianca: 'ALTA' | 'MÉDIA' | 'BAIXA'
}

/** Metadados úteis na UI (derivados da API, sem inferência inventada). */
export interface NoticiaProcessada extends InsightNoticia {
  link: string
  fonte: string
  dataPublicacao: string | null
  articleId: string | null
  imagemUrl: string | null
  linguagem: string | null
}

export interface NewsDataArticle {
  article_id?: string
  title?: string | null
  link?: string | null
  description?: string | null
  content?: string | null
  pubDate?: string | null
  source_id?: string | null
  source_name?: string | null
  source_priority?: number | null
  category?: string[] | null
  country?: string[] | null
  language?: string | null
  keywords?: string[] | null
  image_url?: string | null
  /**
   * Interno: veio da query NewsData só cripto — classificar como CRIPTO no filtro
   * (a API já filtrou por termos cripto; sem isto, muitos caíam em «Macro» só pela palavra «mercado»).
   */
  _yieldscanCryptoQuery?: boolean
}

export type NewsDataApiResponse =
  | {
      status: 'success'
      totalResults?: number
      results: NewsDataArticle[]
      nextPage?: string
    }
  | {
      status: 'error'
      results: { message?: string; code?: string }
    }

/** Query principal só cripto (NewsData). */
const KEYWORDS_CRYPTO =
  'bitcoin OR ethereum OR cryptocurrency OR solana OR blockchain OR defi OR stablecoin OR altcoin OR xrp OR ripple OR binance OR coinbase OR web3 OR nft OR memecoin OR halving'

/**
 * Segunda query em paralelo — planos gratuitos falham ou esvaziam com uma única string longa;
 * termos mais curtos aumentam artigos úteis no merge.
 */
const KEYWORDS_CRYPTO_ALT =
  'btc OR eth OR crypto OR cripto OR bitcoin ETF OR spot bitcoin OR on-chain OR layer-2 OR staking OR exchange OR wallet OR airdrop'

/**
 * Palavras-mínimo (texto normalizado) para manter artigo no feed cripto.
 */
const RELEVANCE_WORDS = new Set([
  'bitcoin',
  'ethereum',
  'cripto',
  'crypto',
  'cryptocurrency',
  'blockchain',
  'altcoin',
  'defi',
  'nft',
  'token',
  'coinbase',
  'binance',
  'solana',
  'xrp',
  'bnb',
  'stablecoin',
  'satoshi',
  'web3',
  'halving',
  'memecoin',
  'kraken',
  'dogecoin',
  'staking',
  'hash',
  'wallet',
  'dex',
  'proof-of-work',
  'proof of stake',
])

/** Fontes tratadas como maior credibilidade editorial (heurística conservadora). */
const FONTES_ALTA = new Set(
  [
    'reuters',
    'bloomberg',
    'financial times',
    'the wall street journal',
    'wsj',
    'the economist',
    'associated press',
    'ap news',
    'bbc',
    'cnbc',
    'ft.com',
    'agencia publica',
    'publico',
    'público',
    'folha',
    'estadao',
    'o estado de',
    'valor economico',
    'valor econômico',
    'cnn brasil',
  ].map((s) => s.toLowerCase())
)

/** Texto normalizado (minúsculas, sem acentos) para classificar PT/EN. */
function normalizarTextoMatch(s: string): string {
  return stripHtml(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

const RE_CRYPTO =
  /\b(bitcoin|btc|ethereum|eth|ether|crypto|cripto|criptomoedas?|cryptocurrenc(y|ies)|blockchain|defi|stablecoins?|stable\s*coins?|altcoins?|solana|dogecoin|memecoins?|web3|nfts?|tokens?|satoshi|halving|coinbase|binance|kraken|etf\s*bitcoin|spot\s*etf|negociacao\s+de\s+cripto|mercado\s+de\s+cripto|crypto\s+futures|futures?\s+cripto|xrp|ripple|bnb|polygon|avax|cardano|ada|monero|litecoin)\b/i

const RE_POS =
  /\b(approval|approve|aprovado|homologado|adoption|adocao|breakthrough|partnership|parceria|record high|recorde|all-?time high|rally|surge\s+approval|etf\s+approved|launch\s+success|alta\s+forte)\b/i
const RE_NEG =
  /\b(hack|exploit|breach|invasao|ban\b|banned|banid|lawsuit|processo|acao judicial|fraud|fraude|scam|golpe|collapse|colapso|crash|queda brusca|selloff|seizure|apreensao|criminal charge|shutdown|encerramento|bankrupt|falencia)\b/i

const RE_BTC = /\b(bitcoin|btc)\b/i
const RE_ETH = /\b(ethereum|ether|\beth\b)\b/i
const RE_ALT = /\b(altcoin|solana|ada|cardano|xrp|ripple|bnb|polygon|avax|doge|memecoin)\b/i

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Texto que a NewsData insere em planos gratuitos dentro da descrição. */
function limparSnippetNewsData(s: string): string {
  return s
    .replace(/\bONLY\s+AVAILABLE\s+IN\s+PAID\s+PLANS\b/gi, ' ')
    .replace(/\bDISPON[IÍ]VEL\s+APENAS\s+EM\s+PLANOS\s+PAGOS\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncarTitulo(t: string, maxPalavras = 10): string {
  const w = t.trim().split(/\s+/).filter(Boolean)
  if (w.length <= maxPalavras) return t.trim()
  return w.slice(0, maxPalavras).join(' ') + '…'
}

/** Até ~2 linhas: 1–2 frases do texto original, sem acrescentar factos. */
function resumoDuasLinhas(texto: string): string {
  const t = limparSnippetNewsData(stripHtml(texto).replace(/\s+/g, ' ').trim())
  if (!t) return ''
  const frases = t.split(/(?<=[.!?])\s+/).filter((f) => f.length > 0)
  let out = frases[0] ?? t
  if (frases[1] && out.length + frases[1].length < 280) {
    out = `${out} ${frases[1]}`.trim()
  }
  if (out.length > 320) out = out.slice(0, 317).trim() + '…'
  return out
}

function textoParaAnalise(a: NewsDataArticle): string {
  const parts = [a.title, a.description, a.content, ...(a.keywords ?? [])].filter(Boolean).join(' ')
  return normalizarTextoMatch(parts)
}

function categoriasApiIndicamCripto(cats: string[] | null | undefined): boolean {
  if (!cats?.length) return false
  return cats.some((c) => {
    const x = c.toLowerCase()
    return (
      x === 'crypto' ||
      x === 'cryptocurrency' ||
      x.includes('crypto') ||
      x.includes('blockchain') ||
      x.includes('bitcoin') ||
      x.includes('ethereum') ||
      x.includes('defi')
    )
  })
}

function classificarImpacto(full: string): InsightNoticia['impacto'] {
  if (RE_NEG.test(full)) return 'NEGATIVO'
  if (RE_POS.test(full)) return 'POSITIVO'
  return 'NEUTRO'
}

/**
 * Análise de texto livre alinhada ao feed cripto.
 */
export function analisarTextoMercado(textoBruto: string): {
  normalizado: string
  categoria: InsightNoticia['categoria']
  impacto: InsightNoticia['impacto']
  relevanteParaFeed: boolean
} {
  const full = normalizarTextoMatch(textoBruto)
  const relevanteParaFeed =
    RE_CRYPTO.test(full) || [...RELEVANCE_WORDS].some((w) => full.includes(w))
  const impacto = classificarImpacto(full)
  return { normalizado: full, categoria: 'CRIPTO', impacto, relevanteParaFeed }
}

function ativosAfetados(full: string): InsightNoticia['ativos'] {
  const out = new Set<InsightNoticia['ativos'][number]>()
  if (RE_BTC.test(full)) out.add('BTC')
  if (RE_ETH.test(full)) out.add('ETH')
  if (RE_ALT.test(full)) out.add('ALTCOINS')
  if (out.size === 0) out.add('MERCADO GLOBAL')
  return Array.from(out)
}

function classificarConfianca(sourceName: string, sourcePriority: number | null | undefined): InsightNoticia['confianca'] {
  const n = sourceName.toLowerCase().trim()
  for (const f of FONTES_ALTA) {
    if (n.includes(f)) return 'ALTA'
  }
  if (typeof sourcePriority === 'number' && sourcePriority > 0 && sourcePriority < 35000) {
    return 'MÉDIA'
  }
  if (n.length > 2) return 'MÉDIA'
  return 'BAIXA'
}

/** Uma página NewsData; `page` = token `nextPage` da resposta anterior. */
async function fetchNewsDataSinglePage(
  key: string,
  q: string,
  pageToken: string | undefined,
  size: string
): Promise<{ results: NewsDataArticle[]; nextPage?: string }> {
  const url = new URL(NEWSDATA_NEWS_URL)
  url.searchParams.set('apikey', key)
  url.searchParams.set('q', q)
  url.searchParams.set(
    'language',
    (process.env.NEWSDATA_LANGUAGES ?? 'en,pt').trim() || 'en,pt'
  )
  url.searchParams.set('category', 'business,technology,top,science')
  url.searchParams.set('prioritydomain', 'top')
  url.searchParams.set('size', size)
  if (pageToken) url.searchParams.set('page', pageToken)

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
      const data = (await res.json()) as NewsDataApiResponse
      if (data.status !== 'success' || !Array.isArray(data.results)) {
        return { results: [] }
      }
      const nextPage =
        'nextPage' in data && typeof data.nextPage === 'string' ? data.nextPage : undefined
      return { results: data.results, nextPage }
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return { results: [] }
  }
}

/**
 * Várias páginas NewsData (cada resposta traz ~`size` artigos; funde até `maxArticles`).
 * Sem isto, uma única página (~10 itens) deixa o filtro «Cripto» quase vazio.
 */
async function fetchQueryAccumulate(
  key: string,
  q: string,
  opts?: { maxArticles?: number; maxPages?: number; size?: string }
): Promise<NewsDataArticle[]> {
  const maxArticles = opts?.maxArticles ?? 10
  const maxPages = opts?.maxPages ?? 1
  const size = opts?.size ?? '10'
  const out: NewsDataArticle[] = []
  let pageToken: string | undefined

  for (let p = 0; p < maxPages && out.length < maxArticles; p++) {
    const { results, nextPage } = await fetchNewsDataSinglePage(key, q, pageToken, size)
    if (!results.length) break
    out.push(...results)
    pageToken = nextPage
    if (!pageToken) break
  }
  return out.slice(0, maxArticles)
}

/**
 * NewsData (só queries cripto) + CryptoPanic, fundidos sem URLs duplicadas.
 */
export async function pegarTodasNoticias(apiKey?: string): Promise<{
  results: NewsDataArticle[]
  erro?: string
}> {
  const key = (apiKey ?? process.env.NEWSDATA_API_KEY)?.trim()
  if (!key) throw new Error('NEWSDATA_API_KEY não definida. Adicione em .env.local')

  const [newsdataCripto, newsdataCriptoAlt, cryptopanicResults] = await Promise.all([
    fetchQueryAccumulate(key, KEYWORDS_CRYPTO, { maxArticles: 36, maxPages: 5, size: '10' }),
    fetchQueryAccumulate(key, KEYWORDS_CRYPTO_ALT, { maxArticles: 28, maxPages: 4, size: '10' }),
    fetchCryptopanicAsNewsDataArticles(),
  ])

  const marcarCripto = (arr: NewsDataArticle[]): NewsDataArticle[] =>
    arr.map((a) => ({ ...a, _yieldscanCryptoQuery: true }))

  const mergedNd = mergeArticlesDedupe(marcarCripto(newsdataCripto), marcarCripto(newsdataCriptoAlt))
  const results = mergeArticlesDedupe(cryptopanicResults, mergedNd)
  if (results.length === 0) return { results: [], erro: 'sem_artigos' }
  return { results }
}

/**
 * Processa cada artigo: extrai resumo do texto original e classifica com regras fixas (sem LLM).
 * Categoria fixa CRIPTO — o pipeline de entrada já é só fontes cripto.
 */
export function processarNoticia(article: NewsDataArticle): NoticiaProcessada | null {
  const title = (article.title ?? '').trim()
  const link = (article.link ?? '').trim()
  if (!title && !link) return null

  const fonte = (article.source_name ?? article.source_id ?? 'Fonte desconhecida').trim()
  const baseText = [article.description, article.content, title].filter(Boolean).join('\n')
  const resumoBase = resumoDuasLinhas(baseText || title)
  const fullLower = textoParaAnalise(article)

  const categoria: InsightNoticia['categoria'] = 'CRIPTO'
  const resumo = resumoBase || title

  const impacto = classificarImpacto(fullLower)
  const ativos = ativosAfetados(fullLower)
  const confianca = classificarConfianca(fonte, article.source_priority ?? undefined)

  return {
    titulo: truncarTitulo(title || link.slice(0, 80)),
    resumo: resumo || title,
    categoria,
    impacto,
    ativos,
    confianca,
    link: link || '#',
    fonte,
    dataPublicacao: article.pubDate ?? null,
    articleId: article.article_id ?? null,
    imagemUrl: article.image_url?.trim() || null,
    linguagem: article.language ?? null,
  }
}

const MAX_NOTICIAS_FEED = 60

function artigoPassaFiltroCripto(fullNorm: string, a: NewsDataArticle): boolean {
  if (typeof a.article_id === 'string' && a.article_id.startsWith('cryptopanic-')) return true
  if (a._yieldscanCryptoQuery === true) return true
  if (categoriasApiIndicamCripto(a.category ?? null)) return true
  if (RE_CRYPTO.test(fullNorm)) return true
  return [...RELEVANCE_WORDS].some((w) => fullNorm.includes(w))
}

export function processarNoticias(articles: NewsDataArticle[]): NoticiaProcessada[] {
  if (!Array.isArray(articles)) return []

  const todas: NoticiaProcessada[] = []
  for (const a of articles) {
    const fullNorm = normalizarTextoMatch([a.title, a.description].filter(Boolean).join(' '))
    if (!artigoPassaFiltroCripto(fullNorm, a)) continue
    const p = processarNoticia(a)
    if (p) todas.push(p)
  }

  todas.sort((a, b) => {
    const da = a.dataPublicacao ? new Date(a.dataPublicacao.replace(' ', 'T')).getTime() : 0
    const db = b.dataPublicacao ? new Date(b.dataPublicacao.replace(' ', 'T')).getTime() : 0
    return db - da
  })

  return todas.slice(0, MAX_NOTICIAS_FEED)
}

/** JSON só com os campos obrigatórios do contrato. */
export function paraJsonInsights(itens: NoticiaProcessada[]): InsightNoticia[] {
  return itens.map(({ titulo, resumo, categoria, impacto, ativos, confianca }) => ({
    titulo,
    resumo,
    categoria,
    impacto,
    ativos,
    confianca,
  }))
}
