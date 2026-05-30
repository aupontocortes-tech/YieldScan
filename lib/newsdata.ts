/**
 * NewsData.io — integração server-side.
 * Defina NEWSDATA_API_KEY em `.env.local` (nunca commite a chave).
 *
 * Endpoint pedido pelo produto: https://newsdata.io/api/1/news
 *
 * Notícias cripto extra: CryptoPanic (Developer API v2) — CRYPTOPANIC_AUTH_TOKEN.
 */

import { fetchAiNewsFromRssFeeds } from '@/lib/ai-news-rss'
import { fetchCryptoCvAsArticles } from '@/lib/crypto-cv-news'
import { fetchCoindeskAsArticles } from '@/lib/tendencias/fetch-coindesk'
import { fetchGnewsAsArticles } from '@/lib/gnews'
import { fallbackImagemPorCategoria } from '@/lib/news-image-fallback'
import { textoIndicaFocoInteligenciaArtificial } from '@/lib/news-ia-strict'
import { normalizeNewsPublishedAt, parseNewsPublishedAt } from '@/lib/news-time'
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
  /** Sempre definida (API ou fallback por categoria). */
  imagemUrl: string
  linguagem: string | null
  /** Evento crítico (score de palavras-chave ≥ 8); usado para ordenação — layout pode ignorar. */
  isBreaking: boolean
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
  /** Campos opcionais de imagem que algumas fontes devolvem. */
  image?: string | null
  imageUrl?: string | null
  thumbnail?: string | null
  enclosure?: { link?: string | null; url?: string | null } | null
  media?: { thumbnail?: string | null; content?: string | null } | null
  /** Nome comum em APIs estilo NewsAPI. */
  urlToImage?: string | null
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
  'bitcoin OR ethereum OR cripto OR blockchain OR altcoin OR inflation OR geopolitics OR sanctions OR conflict OR war OR ukraine OR russia OR china OR taiwan OR middle east OR OpenAI OR ChatGPT OR artificial intelligence OR machine learning'

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

/** Palavras-chave por categoria (texto normalizado; inclui PT comum). */
const RE_CLASS_GEO =
  /\b(war|guerra|trump|iran|irao|china|russia|ucrania|ukraine|conflict|conflito|government|governo|attack|ataque|missile|explosion|explosao|invasion|invasao|sanctions|sanction|sancoes)\b/i
const RE_CLASS_MACRO =
  /\b(inflation|inflacao|interest rate|taxa de juros|\bfed\b|federal reserve|central bank|banco central|economy|economia|recession|recessao|recessão|gdp|pib|unemployment|desemprego)\b/i
const RE_CLASS_CRIPTO =
  /\b(bitcoin|btc|ethereum|eth|crypto|cripto|aave|binance|blackrock)\b/i
const RE_CLASS_IA =
  /\b(openai|nvidia|chatgpt|machine learning|artificial intelligence|inteligencia artificial|\bai\b)\b/i

function passaFiltroPalavrasChave(full: string, article: NewsDataArticle): boolean {
  if (
    RE_CLASS_GEO.test(full) ||
    RE_CLASS_MACRO.test(full) ||
    RE_CLASS_CRIPTO.test(full) ||
    RE_CLASS_IA.test(full)
  )
    return true
  if (article._yieldscanCryptoQuery === true) return true
  const aid = article.article_id
  if (typeof aid === 'string' && (aid.startsWith('cryptopanic-') || aid.startsWith('cryptocv-'))) return true
  if (article._yieldscanAiQuery === true && textoIndicaFocoInteligenciaArtificial(full)) return true
  return false
}

/** Soma só de palavras-chave (antes de recência); corte mínimo para entrar no feed. */
const MIN_SCORE_NOTICIA = 3

/** Notícias críticas (soma de tiers de palavras-chave); ordenação prioritária. */
const SCORE_MIN_BREAKING = 8

const RE_SCORE_CRITICO =
  /\b(war|guerra|attack|ataque|missile|missil|explosion|explosao|explosão|invasion|invasao|invasão|sanctions|sanction|sancoes|sanções|trump|iran|irao|irã|irão)\b/i
const RE_SCORE_MACRO =
  /\b(\bfed\b|federal reserve|interest rate|taxa de juros|inflation|inflação|inflacao|central bank|banco central|recession|recessao|recessão|\bgdp\b|\bpib\b|unemployment|desemprego)\b/i
const RE_SCORE_CRIPTO =
  /\b(\betf\b|bitcoin|\bbtc\b|\bsec\b|ethereum|\beth\b|aave|binance|crypto|cripto|blackrock)\b/i
const RE_SCORE_IA = /\b(openai|nvidia|chatgpt|\bai\b)\b/i

/** Pontuação só por conteúdo (Bloomberg-style); blocos somados. */
function pontuarPalavrasChaveNoticia(full: string): number {
  let score = 0
  if (RE_SCORE_CRITICO.test(full)) score += 5
  if (RE_SCORE_MACRO.test(full)) score += 4
  if (RE_SCORE_CRIPTO.test(full)) score += 3
  if (RE_SCORE_IA.test(full)) score += 2
  return score
}

/** +2 se publicada há menos de 1 h; +1 se menos de 3 h. */
function boostRecencia(pubDate: string | null | undefined): number {
  if (!pubDate) return 0
  const t = parseNewsPublishedAt(pubDate)
  if (!Number.isFinite(t)) return 0
  const ageMs = Date.now() - t
  const h = ageMs / 3_600_000
  // Boost agressivo para sensação de tempo real no ranking.
  if (h < 0) return 5
  if (h < 2) return 5
  return 0
}

function dedupeArtigosPorTitulo(articles: NewsDataArticle[]): NewsDataArticle[] {
  const seen = new Set<string>()
  const out: NewsDataArticle[] = []
  for (const a of articles) {
    const t = normalizarTextoMatch((a.title ?? '').trim()).replace(/\s+/g, ' ')
    if (t.length >= 12) {
      if (seen.has(t)) continue
      seen.add(t)
    }
    out.push(a)
  }
  return out
}

/**
 * Uma categoria principal. Prioridade se várias combinam: Geopolítica > Macroeconomia > Cripto > IA.
 */
function classificarAutomatica(full: string, article: NewsDataArticle): InsightNoticia['categoria'] {
  const geo = RE_CLASS_GEO.test(full)
  const macro = RE_CLASS_MACRO.test(full)
  const criptoKw = RE_CLASS_CRIPTO.test(full)
  const iaKw = RE_CLASS_IA.test(full)
  const fromDedicatedCrypto =
    article._yieldscanCryptoQuery === true ||
    (typeof article.article_id === 'string' &&
      (article.article_id.startsWith('cryptopanic-') || article.article_id.startsWith('cryptocv-')))
  const iaMarcada =
    iaKw || (article._yieldscanAiQuery === true && textoIndicaFocoInteligenciaArtificial(full))

  if (geo) return 'GEOPOLÍTICA'
  if (macro) return 'MACRO'
  if (criptoKw || fromDedicatedCrypto) return 'CRIPTO'
  if (iaMarcada) return 'IA'

  return classificarCategoria(full, article.category ?? null)
}

/** Texto normalizado (minúsculas, sem acentos) para classificar PT/EN. */
function normalizarTextoMatch(s: string): string {
  return stripHtml(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/**
 * Relações internacionais, conflito, defesa, sanções entre Estados — sem eleições/congresso
 * (processos legislativos/domésticos entram em Macro com o restante tema mercado).
 */
const RE_GEOPOLITICA =
  /\b(ucrania|ukraine|russia|russian|putin|zelensk|china|chines|beijing|taiwan|taipei|estreito|iran|irao|\bira\b|israel|gaza|palestin|hamas|hezbollah|siria|syria|yemen|iemen|iraque|iraq|afeganistao|afghanistan|taliban|coreia do norte|north korea|arma(s)? nuclear|otan|nato|guerra|war|invasao|invasion|conflito|conflict|militar|military|pentagon|ministr(o|a) da defesa|defense secretary|sancoes|sanction|embargo|geopolit|oriente medio|middle east|mar vermelho|red sea|estreito|strait|opec\b|refugiad|embaixa(da|dor)|espionage|spy\b|golpe de estado\b|coupe d'etat|venezuela|nicaragua|crimeia|crimea|donbas|ceasefire|alto el fuego|tariff(s)?|tarifa(s)?|trade war|guerra comercial|diplomac(y|ia)|fronteira(s)?|border(s)?)\b/i

/** Eleições, legislativo, Judiciário, governo — foco doméstico / institucional. */
const RE_POLITICA =
  /\b(eleicao|eleiç|election|eleitoral|referendum|plebiscito|runoff|segundo turno|impeachment|congresso nacional|camara dos deputados|senado federal|plenario|plenário|comissao parlamentar|voto em\b|urnas?\b|parlamento europeu|european parliament|\bcongress\b|\bsenate\b|house of representatives|downing street|white house staff|gabinete (ministerial|do)|coalizao|coalition government|ministerio publico|stf\b|supremo tribunal|tribunal superior|judiciario|veto (presidencial|do presidente)|projeto de lei|bill (to|passes)|pec\b|emenda constitucional|nomeacao (para|de) ministr|cabinet reshuffle)\b/i

const RE_MACRO =
  /\b(fed|federal reserve|taxa de juros|interest rate|juros|inflacao|inflation|cpi\b|pce\b|pib|gdp|recessao|recession|desemprego|unemployment|payroll|non-?farm|tesouro|treasury\b|bond yield|yield curve|banco central|central bank|bce|ecb|boj|macroeconom|politica monetaria|monetary policy|politica fiscal|fiscal policy|orcamento|budget deficit|deficit publico|selic|copom|quantitative easing|stimulus\b|g20\b|\bg7\b|imf\b|fmi|world bank|banco mundial|oecd|ocde|davos|economic forum)\b/i

/** Mercados e empresas (não basta a palavra «mercado» genérica). */
const RE_MACRO_MERCADOS =
  /\b(nasdaq|dow jones|s&p|sp\s*500|ibovespa|bovespa|stock(s)?\b|acoes\b|share(s)? price|equity market|earnings\b|eps\b|ipo\b|m&a|merger|bull market|bear market|volatil|vix\b|commodit(y|ies)|brent|wti\b|gold price|oil price|forex|fx market|negociacao\b|trading floor)\b/i
const RE_CRYPTO =
  /\b(bitcoin|btc|ethereum|eth|ether|crypto|cripto|criptomoedas?|cryptocurrenc(y|ies)|blockchain|defi|stablecoins?|stable\s*coins?|altcoins?|solana|dogecoin|memecoins?|web3|nfts?|tokens?|satoshi|halving|coinbase|binance|kraken|etf\s*bitcoin|spot\s*etf|negociacao\s+de\s+cripto|mercado\s+de\s+cripto|crypto\s+futures|futures?\s+cripto|xrp|ripple|bnb|polygon|avax|cardano|ada|monero|litecoin)\b/i

const RE_POS =
  /\b(approval|approve|aprovado|homologado|adoption|adocao|breakthrough|partnership|parceria|record high|recorde|all-?time high|rally|surge\s+approval|etf\s+approved|launch\s+success|alta\s+forte)\b/i
const RE_NEG =
  /\b(hack|exploit|breach|invasao|ban\b|banned|banid|lawsuit|processo|acao judicial|fraud|fraude|scam|golpe|collapse|colapso|crash|queda brusca|selloff|seizure|apreensao|criminal charge|shutdown|encerramento|bankrupt|falencia)\b/i
const RE_RASO_OU_LOCAL =
  /\b(celebrity|famoso|rumor|rumour|boato|viral|influencer|curiosidade|esporte local|bairro|municipal|cidade pequena|fofoca)\b/i

const RE_BTC = /\b(bitcoin|btc)\b/i
const RE_ETH = /\b(ethereum|ether|\beth\b)\b/i
const RE_ALT = /\b(altcoin|solana|ada|cardano|xrp|ripple|bnb|polygon|avax|doge|memecoin)\b/i

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function toText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function imagemPareceValida(raw: string): boolean {
  const s = raw.trim()
  if (!s) return false
  if (/^(data|blob):/i.test(s)) return false
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const full = `${u.hostname}${u.pathname}${u.search}`.toLowerCase()
    if (/(placeholder|spacer|blank|default-image|no-?image|pixel\.gif)/i.test(full)) return false
    if (/(^|[\/_-])(16x16|24x24|32x32|48x48|64x64)([\/_.-]|$)/i.test(full)) return false
    if (/(^|[\/_-])(icon|favicon|sprite|avatar|logo)([\/_.-]|$)/i.test(full)) return false
    const ext = u.pathname.toLowerCase()
    if (/\.(jpg|jpeg|png|webp|gif|avif|bmp|svg)$/i.test(ext)) return true
    // Algumas APIs servem imagem sem extensão explícita.
    return true
  } catch {
    return false
  }
}

function escolherImagemNoticia(a: NewsDataArticle): string | null {
  const candidates: string[] = []
  const rec = a as Record<string, unknown>

  candidates.push(
    toText(a.image_url),
    toText(a.image),
    toText(a.urlToImage),
    toText(a.imageUrl),
    toText(a.thumbnail),
    toText(a.enclosure?.link),
    toText(a.enclosure?.url),
    toText(a.media?.content),
    toText(a.media?.thumbnail),
    toText(rec['imageUrlLarge']),
    toText(rec['cover_image']),
    toText(rec['coverImage']),
    toText(rec['thumbnail_url']),
    toText(rec['urlToImage'])
  )

  for (const c of candidates) {
    if (imagemPareceValida(c)) return c
  }
  return null
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
  const cry = RE_CRYPTO.test(blob)
  /* Futuros/swaps sobre cripto (ex. Índia Gen Z + futures) */
  const futuroCripto =
    /\bfuturos?\b/.test(full) && /\b(cripto|criptomoeda|bitcoin|btc|eth|crypto|coin)\b/.test(full)

  const geo = RE_GEOPOLITICA.test(full)
  const policyMacro = RE_MACRO.test(full)
  const mercados = RE_MACRO_MERCADOS.test(full)
  const pol = RE_POLITICA.test(full)
  const gov = /\b(governo|government|presidente\b|president\b|ministr|prime minister|premier\b)\b/i.test(full)

  /**
   * Cripto tem prioridade quando o texto menciona BTC/ETH/blockchain/etc.
   * Ordem: cripto → geopolítica → macroeconomia.
   * IA só em `processarNoticia` com `_yieldscanAiQuery` (feeds/queries IA + enrich).
   */
  if (cry || futuroCripto) return 'CRIPTO'
  if (geo) return 'GEOPOLÍTICA'
  if (policyMacro || pol || gov || mercados) return 'MACRO'
  return 'MACRO'
}

function classificarImpacto(full: string): InsightNoticia['impacto'] {
  if (RE_NEG.test(full)) return 'NEGATIVO'
  if (RE_POS.test(full)) return 'POSITIVO'
  return 'NEUTRO'
}

/**
 * Análise de texto livre com as mesmas regras de categoria/impacto das notícias.
 * `relevanteParaFeed`: cripto, macroeconomia, geopolítica ou mercado em geral.
 */
export function analisarTextoMercado(textoBruto: string): {
  normalizado: string
  categoria: InsightNoticia['categoria']
  impacto: InsightNoticia['impacto']
  relevanteParaFeed: boolean
} {
  const full = normalizarTextoMatch(textoBruto)
  const cry = RE_CRYPTO.test(full)
  const geo = RE_GEOPOLITICA.test(full)
  const pol = RE_POLITICA.test(full)
  const macro = RE_MACRO.test(full) || RE_MACRO_MERCADOS.test(full)
  const ai = textoIndicaFocoInteligenciaArtificial(full)
  const mercadoGeral =
    /\b(economy|economic|economia|mercado financeiro|mercado de capitais|finance|financas|financeiro|stock|stocks|bolsa|nasdaq|sp500|s&p|dollar|dólar|euro|yen|oil|petróleo|gold|ouro|treasury|yield|tariff|trade|banco|bank|ipo|earnings)\b/i.test(
      full
    )
  const relevanteParaFeed = cry || geo || pol || macro || mercadoGeral || ai
  const categoria = classificarCategoria(full, null)
  const impacto = classificarImpacto(full)
  return { normalizado: full, categoria, impacto, relevanteParaFeed }
}

function ativosAfetados(full: string, categoria: InsightNoticia['categoria']): InsightNoticia['ativos'] {
  const out = new Set<InsightNoticia['ativos'][number]>()
  if (RE_BTC.test(full)) out.add('BTC')
  if (RE_ETH.test(full)) out.add('ETH')
  if (RE_ALT.test(full)) out.add('ALTCOINS')
  if (
    categoria === 'GEOPOLÍTICA' ||
    categoria === 'MACRO' ||
    categoria === 'IA'
  ) {
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
  // Evita over-filter da API (alguns planos retornam vazio com category+prioritydomain).
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
    if (!textoIndicaFocoInteligenciaArtificial(textoParaAnalise(a))) continue
    a._yieldscanAiQuery = true
  }
}

/**
 * Quando uma URL entrou primeiro pela query geral, pode perder o marcador de query cripto.
 * Reaplica _yieldscanCryptoQuery por URL para o filtro «Cripto» não esvaziar.
 */
function enrichYieldscanCryptoFlag(results: NewsDataArticle[], cryptoArticles: NewsDataArticle[]): void {
  if (!cryptoArticles.length) return
  const cryptoKeys = new Set<string>()
  for (const a of cryptoArticles) {
    const raw = (a.link ?? '').trim()
    const key =
      normalizarLinkDedupe(raw || undefined) ||
      `id:${String(a.article_id ?? a.title ?? '').toLowerCase()}`
    cryptoKeys.add(key)
  }
  for (const a of results) {
    const raw = (a.link ?? '').trim()
    const key =
      normalizarLinkDedupe(raw || undefined) ||
      `id:${String(a.article_id ?? a.title ?? '').toLowerCase()}`
    if (!cryptoKeys.has(key)) continue
    a._yieldscanCryptoQuery = true
  }
}

/** NewsData + RSS IA (fallback). CryptoPanic e GNews ficam em `pegarTodasNoticias`. */
async function fetchNewsdataComRss(ndKey: string): Promise<NewsDataArticle[]> {
  const [newsdataGeral, newsdataCripto, newsdataCriptoFallback, newsdataAi, newsdataAiAlt, rssAiArticles] =
    await Promise.all([
      fetchQueryAccumulate(ndKey, KEYWORDS_Q, { maxArticles: 18, maxPages: 3, size: '10' }),
      fetchQueryAccumulate(ndKey, KEYWORDS_CRYPTO, { maxArticles: 28, maxPages: 4, size: '10' }),
      fetchQueryAccumulate(ndKey, 'bitcoin OR ethereum OR crypto', { maxArticles: 18, maxPages: 3, size: '10' }),
      fetchQueryAccumulate(ndKey, KEYWORDS_AI, { maxArticles: 24, maxPages: 4, size: '10' }),
      fetchQueryAccumulate(ndKey, KEYWORDS_AI_ALT, { maxArticles: 16, maxPages: 3, size: '10' }),
      fetchAiNewsFromRssFeeds({ maxPerFeed: 20, timeoutMs: 12_000 }),
    ])

  const newsdataAiMerged = mergeArticlesDedupe(
    mergeArticlesDedupe(newsdataAi, newsdataAiAlt),
    rssAiArticles
  )

  const newsdataCriptoMerged = mergeArticlesDedupe(newsdataCripto, newsdataCriptoFallback)
  const newsdataCriptoMarcados: NewsDataArticle[] = newsdataCriptoMerged.map((a) => ({
    ...a,
    _yieldscanCryptoQuery: true,
  }))

  const newsdataAiMarcados: NewsDataArticle[] = newsdataAiMerged.map((a) => ({
    ...a,
    _yieldscanAiQuery: false,
  }))

  const mergedNd = mergeArticlesDedupe(newsdataGeral, newsdataCriptoMarcados)
  const mergedNdComIa = mergeArticlesDedupe(mergedNd, newsdataAiMarcados)
  enrichYieldscanCryptoFlag(mergedNdComIa, newsdataCriptoMarcados)
  enrichYieldscanAiFlag(mergedNdComIa, newsdataAiMerged)
  return mergedNdComIa
}

/**
 * CoinDesk + GNews + cryptocurrency.cv (primários) + CryptoPanic + NewsData/RSS (fallback), fundidos.
 */
export async function pegarTodasNoticias(apiKey?: string | null): Promise<{
  results: NewsDataArticle[]
  erro?: 'sem_artigos' | 'sem_fontes'
}> {
  const ndKey = (apiKey ?? process.env.NEWSDATA_API_KEY)?.trim() || ''

  const [ndBundle, coindesk, gnews, cryptoCv, cryptopanicResults] = await Promise.all([
    ndKey
      ? fetchNewsdataComRss(ndKey)
      : fetchAiNewsFromRssFeeds({ maxPerFeed: 20, timeoutMs: 12_000 }),
    fetchCoindeskAsArticles(60),
    fetchGnewsAsArticles(),
    fetchCryptoCvAsArticles(),
    fetchCryptopanicAsNewsDataArticles(),
  ])

  const coindeskMarcados: NewsDataArticle[] = coindesk.map((a) => ({
    ...a,
    _yieldscanCryptoQuery: true,
  }))

  let merged = mergeArticlesDedupe(gnews, coindeskMarcados)
  merged = mergeArticlesDedupe(merged, cryptoCv)
  merged = mergeArticlesDedupe(merged, cryptopanicResults)
  merged = mergeArticlesDedupe(merged, ndBundle)
  enrichYieldscanCryptoFlag(merged, [...cryptoCv, ...coindeskMarcados])
  merged = dedupeArtigosPorTitulo(merged)

  const temChave =
    Boolean(ndKey) ||
    Boolean(process.env.GNEWS_API_KEY?.trim()) ||
    Boolean(process.env.COINDESK_API_KEY?.trim() || process.env.CRYPTOCOMPARE_API_KEY?.trim()) ||
    Boolean(
      process.env.CRYPTOPANIC_AUTH_TOKEN?.trim() || process.env.CRYPTOPUNK_API_TOKEN?.trim()
    )

  if (!merged.length) {
    return { results: [], erro: temChave ? 'sem_artigos' : 'sem_fontes' }
  }
  return { results: merged }
}

/**
 * Processa cada artigo: extrai resumo do texto original e classifica com regras fixas (sem LLM).
 * Não inventa factos; impacto e categoria tendem a NEUTRO/MACRO quando o texto é ambíguo.
 */
export function processarNoticia(
  article: NewsDataArticle,
  opts?: { isBreaking?: boolean }
): NoticiaProcessada | null {
  const title = (article.title ?? '').trim()
  const link = (article.link ?? '').trim()
  if (!title && !link) return null

  const fonte = (article.source_name ?? article.source_id ?? 'Fonte desconhecida').trim()
  const baseText = [article.description, article.content, title].filter(Boolean).join('\n')
  const resumoBase = resumoDuasLinhas(baseText || title)
  const fullLower = textoParaAnalise(article)

  const categoria = classificarAutomatica(fullLower, article)
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
    dataPublicacao: normalizeNewsPublishedAt(article.pubDate),
    articleId: article.article_id ?? null,
    imagemUrl:
      escolherImagemNoticia(article) ?? fallbackImagemPorCategoria(categoria),
    linguagem: article.language ?? null,
    isBreaking: opts?.isBreaking === true,
  }
}

/**
 * Lista completa relevância → data. A aba «Todos» usa isto integralmente;
 * abas por categoria limitam no cliente (ex.: 10).
 */
export function processarNoticias(articles: NewsDataArticle[]): NoticiaProcessada[] {
  if (!Array.isArray(articles)) return []

  type Row = {
    article: NewsDataArticle
    keywordScore: number
    recencyBoost: number
    scoreFinal: number
    isBreaking: boolean
    ts: number
  }
  const rows: Row[] = []

  for (const a of articles) {
    const title = (a.title ?? '').trim()
    const fromPanic =
      typeof a.article_id === 'string' && a.article_id.startsWith('cryptopanic-')
    if (title.length < 12 && !fromPanic) continue

    const fullNorm = textoParaAnalise(a)
    if (RE_RASO_OU_LOCAL.test(fullNorm)) continue
    if (!passaFiltroPalavrasChave(fullNorm, a)) continue

    const keywordScore = pontuarPalavrasChaveNoticia(fullNorm)
    if (keywordScore < MIN_SCORE_NOTICIA) continue

    const recencyBoost = boostRecencia(a.pubDate)
    const scoreFinal = keywordScore + recencyBoost
    const isBreaking = keywordScore >= SCORE_MIN_BREAKING

    const rawTs = parseNewsPublishedAt(a.pubDate, 0)
    rows.push({
      article: a,
      keywordScore,
      recencyBoost,
      scoreFinal,
      isBreaking,
      ts: Number.isFinite(rawTs) ? rawTs : 0,
    })
  }

  rows.sort((a, b) => {
    if (a.isBreaking !== b.isBreaking) return a.isBreaking ? -1 : 1
    /** Prioridade à data de publicação: o sort só por score fazia subir notícias antigas (ex. «há 12 h» no topo). */
    if (b.ts !== a.ts) return b.ts - a.ts
    return b.scoreFinal - a.scoreFinal
  })

  const todas: NoticiaProcessada[] = []
  const titulosSeen = new Set<string>()
  for (const { article, isBreaking } of rows) {
    const p = processarNoticia(article, { isBreaking })
    if (!p) continue
    const tk = normalizarTextoMatch(p.titulo).replace(/[^\w\s]/g, '').trim()
    if (!tk || titulosSeen.has(tk)) continue
    titulosSeen.add(tk)
    todas.push(p)
  }

  return todas
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
