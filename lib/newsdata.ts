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
  normalizarLinkDedupe,
} from '@/lib/cryptopanic'

export const NEWSDATA_NEWS_URL = 'https://newsdata.io/api/1/news'

/** Formato de saída padronizado (inteligência de mercado). */
export interface InsightNoticia {
  titulo: string
  resumo: string
  categoria: 'CRIPTO' | 'GEOPOLÍTICA' | 'MACRO' | 'IA'
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
  /** Interno: veio da query NewsData só IA — classificar como IA no filtro. */
  _yieldscanAiQuery?: boolean
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

/** Query geral: macro, geo e mercado (+ termos IA para classificação no feed «Todos»). */
const KEYWORDS_Q =
  'bitcoin OR ethereum OR cripto OR blockchain OR altcoin OR inflation OR geopolitics OR OpenAI OR ChatGPT OR artificial intelligence OR machine learning'

/** Segunda query só cripto — a geral muitas vezes vem cheia de macro/geo e o filtro «Cripto» ficava vazio. */
const KEYWORDS_CRYPTO =
  'bitcoin OR ethereum OR cryptocurrency OR solana OR blockchain OR defi OR stablecoin OR altcoin OR xrp OR ripple OR binance OR coinbase OR web3 OR nft OR memecoin OR halving'

/**
 * Query dedicada IA — evitar o token isolado «AI» (a NewsData/planos gratuitos costuma ignorar ou falhar).
 * Segunda query curta em paralelo cobre fornecedores de modelo.
 */
const KEYWORDS_AI =
  'artificial intelligence OR machine learning OR OpenAI OR ChatGPT OR generative AI OR deep learning OR neural network OR large language model'

const KEYWORDS_AI_ALT = 'Anthropic OR Claude OR Gemini OR Copilot OR Nvidia AI OR AI chip OR AI model'

/**
 * Palavras-mínimo para que um artigo seja relevante para o feed.
 * Artigos que não contenham NENHUMA serão descartados.
 */
const RELEVANCE_WORDS = new Set([
  'bitcoin','ethereum','cripto','crypto','cryptocurrency','blockchain','altcoin','defi','nft','token',
  'inflation','inflação','fed','federal reserve','interest rate','taxa de juros',
  'war','guerra','sanction','sanção','geopolit','tariff','tarifa',
  'gdp','pib','recession','recessão','economy','economia','stock market',
  'mercado','bolsa','dollar','dólar','oil','petróleo','market','mercado',
  'coinbase','binance','solana','xrp','bnb','stablecoin','satoshi',
  'openai','chatgpt','anthropic','claude','llm','gpt','machine learning','artificial intelligence',
  'inteligencia artificial','ia generativa','modelo de linguagem',
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

const RE_GEO =
  /\b(ucrania|ucraine|ukraine|russia|russian|china|chines|taiwan|irao|iran|israel|gaza|otan|nato|guerra|war|conflito|conflict|sancoes|sanction|eleicao|election|congresso|congress|senado|senate|parlamento|parliament|geopolit|oriente medio|middle east|coreia do norte|north korea|venezuela)\b/i
const RE_MACRO =
  /\b(fed|federal reserve|taxa de juros|interest rate|juros|inflacao|inflation|cpi|pib|gdp|recessao|recession|desemprego|unemployment|tesouro|treasury|banco central|central bank|bce|ecb|boj|macroeconom|politica monetaria|monetary policy|fiscal|selic)\b/i
const RE_CRYPTO =
  /\b(bitcoin|btc|ethereum|eth|ether|crypto|cripto|criptomoedas?|cryptocurrenc(y|ies)|blockchain|defi|stablecoins?|stable\s*coins?|altcoins?|solana|dogecoin|memecoins?|web3|nfts?|tokens?|satoshi|halving|coinbase|binance|kraken|etf\s*bitcoin|spot\s*etf|negociacao\s+de\s+cripto|mercado\s+de\s+cripto|crypto\s+futures|futures?\s+cripto|xrp|ripple|bnb|polygon|avax|cardano|ada|monero|litecoin)\b/i

const RE_AI =
  /\b(artificial intelligence|inteligencia artificial|machine learning|deep learning|neural networks?|generative ai|ia generativa|large language model|modelo de linguagem|openai|chatgpt|anthropic|llm)\b|gpt-4|gpt-5|\bclaude\b|\bgemini\b|\bcopilot\b/i

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

function classificarCategoria(full: string, catsApi: string[] | null | undefined): InsightNoticia['categoria'] {
  if (categoriasApiIndicamCripto(catsApi)) return 'CRIPTO'

  const catJoined = (catsApi ?? []).join(' ').toLowerCase()
  const blob = `${full} ${catJoined}`
  const geo = RE_GEO.test(blob)
  const macro = RE_MACRO.test(blob)
  const cry = RE_CRYPTO.test(blob)
  const ai = RE_AI.test(blob)
  /* Futuros/swaps sobre cripto (ex. Índia Gen Z + futures) */
  const futuroCripto =
    /\bfuturos?\b/.test(full) && /\b(cripto|criptomoeda|bitcoin|btc|eth|crypto|coin)\b/.test(full)

  /**
   * Cripto tem prioridade quando o texto menciona BTC/ETH/blockchain/etc.
   */
  if (cry || futuroCripto) return 'CRIPTO'
  if (ai) return 'IA'
  if (geo) return 'GEOPOLÍTICA'
  if (macro) return 'MACRO'
  if (/economy|economic|economia|mercado|finance|financas|financeiro/.test(blob)) return 'MACRO'
  return 'MACRO'
}

function classificarImpacto(full: string): InsightNoticia['impacto'] {
  if (RE_NEG.test(full)) return 'NEGATIVO'
  if (RE_POS.test(full)) return 'POSITIVO'
  return 'NEUTRO'
}

/**
 * Análise de texto livre com as mesmas regras de categoria/impacto das notícias.
 * `relevanteParaFeed`: cripto, macro, geopolítica ou mercado em geral.
 */
export function analisarTextoMercado(textoBruto: string): {
  normalizado: string
  categoria: InsightNoticia['categoria']
  impacto: InsightNoticia['impacto']
  relevanteParaFeed: boolean
} {
  const full = normalizarTextoMatch(textoBruto)
  const cry = RE_CRYPTO.test(full)
  const geo = RE_GEO.test(full)
  const macro = RE_MACRO.test(full)
  const ai = RE_AI.test(full)
  const mercadoGeral =
    /\b(economy|economic|economia|mercado|finance|financas|financeiro|stock|stocks|bolsa|nasdaq|sp500|s&p|dollar|dólar|euro|yen|oil|petróleo|gold|ouro|treasury|yield|tariff|trade|banco|bank|ipo|earnings)\b/i.test(
      full
    )
  const relevanteParaFeed = cry || geo || macro || mercadoGeral || ai
  const categoria = classificarCategoria(full, null)
  const impacto = classificarImpacto(full)
  return { normalizado: full, categoria, impacto, relevanteParaFeed }
}

function ativosAfetados(full: string, categoria: InsightNoticia['categoria']): InsightNoticia['ativos'] {
  const out = new Set<InsightNoticia['ativos'][number]>()
  if (RE_BTC.test(full)) out.add('BTC')
  if (RE_ETH.test(full)) out.add('ETH')
  if (RE_ALT.test(full)) out.add('ALTCOINS')
  if (categoria === 'GEOPOLÍTICA' || categoria === 'MACRO' || categoria === 'IA') {
    out.add('MERCADO GLOBAL')
  }
  if (categoria === 'CRIPTO' && out.size === 0) {
    out.add('MERCADO GLOBAL')
  }
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

/** Ligação geopolítica → cripto (texto curto, conservador). */
function notaGeopoliticaCrypto(categoria: InsightNoticia['categoria'], resumo: string): string {
  if (categoria !== 'GEOPOLÍTICA') return resumo
  const add =
    ' Possível canal de risco ou fluxo para ativos de risco (incl. cripto) depende de liquidez global e apetite ao risco; sem previsão de preço.'
  if (resumo.length + add.length > 360) return resumo
  return resumo + add
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
    (process.env.NEWSDATA_LANGUAGES ?? 'pt,en').trim() || 'pt,en'
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
 * Quando a mesma URL já entrou pelo feed geral/cripto, o merge descarta a cópia da query IA
 * e perde-se `_yieldscanAiQuery`. Reaplica o flag por URL para o filtro «IA» não ficar vazio.
 */
function enrichYieldscanAiFlag(results: NewsDataArticle[], aiArticles: NewsDataArticle[]): void {
  if (!aiArticles.length) return
  const aiKeys = new Set<string>()
  for (const a of aiArticles) {
    const raw = (a.link ?? '').trim()
    const key =
      normalizarLinkDedupe(raw || undefined) ||
      `id:${String(a.article_id ?? a.title ?? '').toLowerCase()}`
    aiKeys.add(key)
  }
  for (const a of results) {
    const raw = (a.link ?? '').trim()
    const key =
      normalizarLinkDedupe(raw || undefined) ||
      `id:${String(a.article_id ?? a.title ?? '').toLowerCase()}`
    if (!aiKeys.has(key)) continue
    if (a._yieldscanCryptoQuery === true) continue
    if (typeof a.article_id === 'string' && a.article_id.startsWith('cryptopanic-')) continue
    a._yieldscanAiQuery = true
  }
}

/**
 * NewsData (cripto+macro+geo) + opcional CryptoPanic (cripto), fundidos sem URLs duplicadas.
 */
export async function pegarTodasNoticias(apiKey?: string): Promise<{
  results: NewsDataArticle[]
  erro?: string
}> {
  const key = (apiKey ?? process.env.NEWSDATA_API_KEY)?.trim()
  if (!key) throw new Error('NEWSDATA_API_KEY não definida. Adicione em .env.local')

  /* Menos páginas = resposta mais rápida; volume ainda cobre o feed. */
  const [newsdataGeral, newsdataCripto, newsdataAi, newsdataAiAlt, cryptopanicResults] =
    await Promise.all([
      fetchQueryAccumulate(key, KEYWORDS_Q, { maxArticles: 18, maxPages: 3, size: '10' }),
      fetchQueryAccumulate(key, KEYWORDS_CRYPTO, { maxArticles: 28, maxPages: 4, size: '10' }),
      fetchQueryAccumulate(key, KEYWORDS_AI, { maxArticles: 24, maxPages: 4, size: '10' }),
      fetchQueryAccumulate(key, KEYWORDS_AI_ALT, { maxArticles: 16, maxPages: 3, size: '10' }),
      fetchCryptopanicAsNewsDataArticles(),
    ])

  const newsdataAiMerged = mergeArticlesDedupe(newsdataAi, newsdataAiAlt)

  const newsdataCriptoMarcados: NewsDataArticle[] = newsdataCripto.map((a) => ({
    ...a,
    _yieldscanCryptoQuery: true,
  }))

  const newsdataAiMarcados: NewsDataArticle[] = newsdataAiMerged.map((a) => ({
    ...a,
    _yieldscanAiQuery: true,
  }))

  /* CryptoPanic primeiro: é a API dedicada a cripto; em duplicado de URL, mantém-se o post dela. */
  const mergedNd = mergeArticlesDedupe(newsdataGeral, newsdataCriptoMarcados)
  const mergedNdComIa = mergeArticlesDedupe(mergedNd, newsdataAiMarcados)
  const results = mergeArticlesDedupe(cryptopanicResults, mergedNdComIa)
  enrichYieldscanAiFlag(results, newsdataAiMerged)
  if (results.length === 0) return { results: [], erro: 'sem_artigos' }
  return { results }
}

/**
 * Processa cada artigo: extrai resumo do texto original e classifica com regras fixas (sem LLM).
 * Não inventa factos; impacto e categoria tendem a NEUTRO/MACRO quando o texto é ambíguo.
 */
export function processarNoticia(article: NewsDataArticle): NoticiaProcessada | null {
  const title = (article.title ?? '').trim()
  const link = (article.link ?? '').trim()
  if (!title && !link) return null

  const fonte = (article.source_name ?? article.source_id ?? 'Fonte desconhecida').trim()
  const baseText = [article.description, article.content, title].filter(Boolean).join('\n')
  const resumoBase = resumoDuasLinhas(baseText || title)
  const fullLower = textoParaAnalise(article)

  const categoria =
    article._yieldscanCryptoQuery === true
      ? 'CRIPTO'
      : typeof article.article_id === 'string' && article.article_id.startsWith('cryptopanic-')
        ? 'CRIPTO'
        : article._yieldscanAiQuery === true
          ? 'IA'
          : classificarCategoria(fullLower, article.category ?? null)
  let resumo = notaGeopoliticaCrypto(categoria, resumoBase || title)

  const impacto = classificarImpacto(fullLower)
  const ativos = ativosAfetados(fullLower, categoria)
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

/** Máximo de cartões por categoria no feed (cripto pode ter muito mais que uma página da API). */
const LIMITE_POR_CATEGORIA: Record<InsightNoticia['categoria'], number> = {
  CRIPTO: 40,
  GEOPOLÍTICA: 16,
  MACRO: 16,
  IA: 16,
}

export function processarNoticias(articles: NewsDataArticle[]): NoticiaProcessada[] {
  if (!Array.isArray(articles)) return []

  // Processa e filtra por relevância mínima
  const todas: NoticiaProcessada[] = []
  for (const a of articles) {
    // Descarta artigos sem nenhuma palavra-chave relevante
    const fullNorm = normalizarTextoMatch(
      [a.title, a.description].filter(Boolean).join(' ')
    )
    const fromCryptopanic =
      typeof a.article_id === 'string' && a.article_id.startsWith('cryptopanic-')
    const ehRelevante =
      fromCryptopanic ||
      a._yieldscanCryptoQuery === true ||
      a._yieldscanAiQuery === true ||
      [...RELEVANCE_WORDS].some((w) => fullNorm.includes(w))
    if (!ehRelevante) continue
    const p = processarNoticia(a)
    if (p) todas.push(p)
  }

  // Ordena por data mais recente primeiro
  todas.sort((a, b) => {
    const da = a.dataPublicacao ? new Date(a.dataPublicacao.replace(' ', 'T')).getTime() : 0
    const db = b.dataPublicacao ? new Date(b.dataPublicacao.replace(' ', 'T')).getTime() : 0
    return db - da
  })

  // Limita por categoria (cripto com tecto mais alto)
  const contagem: Record<string, number> = {}
  return todas.filter((n) => {
    const lim = LIMITE_POR_CATEGORIA[n.categoria] ?? 12
    contagem[n.categoria] = (contagem[n.categoria] ?? 0) + 1
    return contagem[n.categoria] <= lim
  })
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
