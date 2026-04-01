/**
 * NewsData.io — integração server-side.
 * Defina NEWSDATA_API_KEY em `.env.local` (nunca commite a chave).
 *
 * Endpoint pedido pelo produto: https://newsdata.io/api/1/news
 */

export const NEWSDATA_NEWS_URL = 'https://newsdata.io/api/1/news'

/** Formato de saída padronizado (inteligência de mercado). */
export interface InsightNoticia {
  titulo: string
  resumo: string
  categoria: 'CRIPTO' | 'GEOPOLÍTICA' | 'MACRO'
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

/** NewsData limita query a 100 chars. */
const KEYWORDS_CRIPTO = 'bitcoin OR ethereum OR cripto OR blockchain OR criptomoeda OR altcoin'
const KEYWORDS_MACRO  = 'inflation OR geopolitics OR sanctions OR tariff OR recession OR treasury'
/** Retrocompatibilidade — usado no antigo pegarNoticias. */
const KEYWORDS_Q = KEYWORDS_CRIPTO

/**
 * Palavras-mínimo para que um artigo seja relevante para o feed.
 * Artigos que não contenham NENHUMA serão descartados.
 */
const RELEVANCE_WORDS = new Set([
  'bitcoin','ethereum','cripto','crypto','blockchain','altcoin','defi','nft','token',
  'inflation','inflação','fed','federal reserve','interest rate','taxa de juros',
  'war','guerra','sanction','sanção','geopolit','tariff','tarifa',
  'gdp','pib','recession','recessão','economy','economia','stock market',
  'mercado','bolsa','dollar','dólar','oil','petróleo','market','mercado',
  'coinbase','binance','solana','xrp','bnb','stablecoin','satoshi',
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
  /\b(bitcoin|btc|ethereum|eth|ether|crypto|cripto|criptomoeda|cryptocurrency|blockchain|defi|stablecoin|stable coin|altcoin|solana|token|etf\s*bitcoin|spot\s*etf)\b/i

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

function classificarCategoria(full: string, catsApi: string[] | null | undefined): InsightNoticia['categoria'] {
  const catJoined = (catsApi ?? []).join(' ').toLowerCase()
  const blob = `${full} ${catJoined}`
  const geo = RE_GEO.test(blob)
  const macro = RE_MACRO.test(blob)
  const cry = RE_CRYPTO.test(blob)

  if (cry && !geo) return 'CRIPTO'
  if (geo) return 'GEOPOLÍTICA'
  if (macro) return 'MACRO'
  if (cry) return 'CRIPTO'
  if (/economy|economic|economia|mercado|finance|financas|financeiro/.test(blob)) return 'MACRO'
  return 'MACRO'
}

function classificarImpacto(full: string): InsightNoticia['impacto'] {
  if (RE_NEG.test(full)) return 'NEGATIVO'
  if (RE_POS.test(full)) return 'POSITIVO'
  return 'NEUTRO'
}

function ativosAfetados(full: string, categoria: InsightNoticia['categoria']): InsightNoticia['ativos'] {
  const out = new Set<InsightNoticia['ativos'][number]>()
  if (RE_BTC.test(full)) out.add('BTC')
  if (RE_ETH.test(full)) out.add('ETH')
  if (RE_ALT.test(full)) out.add('ALTCOINS')
  if (categoria === 'GEOPOLÍTICA' || categoria === 'MACRO') {
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

/**
 * Busca notícias na NewsData.io com as palavras-chave combinadas (OR).
 */
async function fetchQuery(key: string, q: string): Promise<NewsDataArticle[]> {
  const url = new URL(NEWSDATA_NEWS_URL)
  url.searchParams.set('apikey', key)
  url.searchParams.set('q', q)
  url.searchParams.set(
    'language',
    (process.env.NEWSDATA_LANGUAGES ?? 'pt,en').trim() || 'pt,en'
  )
  url.searchParams.set('category', 'business,technology,top')
  url.searchParams.set('prioritydomain', 'top')
  url.searchParams.set('size', '10')

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
      if (data.status !== 'success' || !Array.isArray(data.results)) return []
      return data.results
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return []
  }
}

/**
 * Faz duas queries em paralelo (cripto + macro/geo) para obter até ~20 artigos
 * diversificados e com fontes prioritárias. Deduplica por article_id.
 */
export async function pegarTodasNoticias(apiKey?: string): Promise<{
  results: NewsDataArticle[]
  erro?: string
}> {
  const key = (apiKey ?? process.env.NEWSDATA_API_KEY)?.trim()
  if (!key) throw new Error('NEWSDATA_API_KEY não definida. Adicione em .env.local')

  const [cripto, macro] = await Promise.allSettled([
    fetchQuery(key, KEYWORDS_CRIPTO),
    fetchQuery(key, KEYWORDS_MACRO),
  ])

  const artigos = [
    ...(cripto.status === 'fulfilled' ? cripto.value : []),
    ...(macro.status === 'fulfilled' ? macro.value : []),
  ]

  // Deduplica por article_id ou link
  const seen = new Set<string>()
  const merged: NewsDataArticle[] = []
  for (const a of artigos) {
    const id = (a.article_id ?? a.link ?? '').trim()
    if (id && seen.has(id)) continue
    if (id) seen.add(id)
    merged.push(a)
  }

  if (merged.length === 0) return { results: [], erro: 'sem_artigos' }
  return { results: merged }
}

/** @deprecated Use pegarTodasNoticias. Mantido para compatibilidade. */
export async function pegarNoticias(apiKey?: string): Promise<NewsDataApiResponse> {
  const key = (apiKey ?? process.env.NEWSDATA_API_KEY)?.trim()
  if (!key) throw new Error('NEWSDATA_API_KEY não definida. Adicione em .env.local')
  const results = await fetchQuery(key, KEYWORDS_Q)
  return { status: 'success', results, totalResults: results.length }
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

  const categoria = classificarCategoria(fullLower, article.category ?? null)
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

export function processarNoticias(
  articles: NewsDataArticle[],
  maxPorCategoria = 7
): NoticiaProcessada[] {
  if (!Array.isArray(articles)) return []

  // Processa e filtra por relevância mínima
  const todas: NoticiaProcessada[] = []
  for (const a of articles) {
    // Descarta artigos sem nenhuma palavra-chave relevante
    const fullNorm = normalizarTextoMatch(
      [a.title, a.description].filter(Boolean).join(' ')
    )
    const ehRelevante = [...RELEVANCE_WORDS].some((w) => fullNorm.includes(w))
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

  // Limita por categoria para equilibrar o feed
  const contagem: Record<string, number> = {}
  return todas.filter((n) => {
    contagem[n.categoria] = (contagem[n.categoria] ?? 0) + 1
    return contagem[n.categoria] <= maxPorCategoria
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
