/**
 * Twitter / X API v2 (Bearer Token, app-only).
 *
 * OBRIGATÓRIO no servidor: TWITTER_BEARER_TOKEN (Vercel → Environment Variables).
 * Sem isto, não há tweets — não é possível “ligar” o X sem o teu token.
 *
 * TWITTER_USERNAMES — lista completa sem @ (substitui defaults)
 * TWITTER_EXTRA_USERNAMES — acrescenta contas
 * TWITTER_STRICT_ONLY=1 — só tweets que passem filtro estrito (menos posts)
 */

import { analisarTextoMercado, type InsightNoticia } from '@/lib/newsdata'

const TWITTER_API = 'https://api.twitter.com/2'

/** Contas base (sem @). Walter Bloomberg → estilo headlines @DeItaone. */
export const TWITTER_HANDLES_PADRAO = [
  'realDonaldTrump',
  'DeItaone',
  'WatcherGuru',
  'ArthurReis',
] as const

export interface TweetMercadoItem {
  id: string
  texto: string
  autorNome: string
  autorHandle: string
  url: string
  dataPublicacao: string
  categoria: InsightNoticia['categoria']
  impacto: InsightNoticia['impacto']
  ativos: InsightNoticia['ativos']
  tipo: 'tweet'
}

/** Palavras que alargam o feed além de cripto/macro/geo (política, mercado, breaking). */
const RE_RELAXADO =
  /\b(trump|biden|white\s*house|president|tariff|tariffs|china|trade|nato|war|iran|israel|ukraine|gaza|oil|opec|fed|powell|rate\s*cut|stock|nasdaq|sp\s*500|s&p|dollar|euro|yen|yield|treasury|inflation|jobs\s*report|cpi|gdp|breaking|just\s*in|alert|report|crypto|bitcoin|btc|eth|ethereum|solana|etf|sec|regulation)\b/i

export interface TwitterFeedResult {
  tweets: TweetMercadoItem[]
  handlesSeguidos: string[]
  ativo: boolean
  /** Código interno para UI */
  aviso?: 'sem_token' | 'token_invalido' | 'sem_permissao' | 'rate_limit' | 'ok'
  /** Texto seguro para mostrar ao utilizador (PT) */
  mensagem?: string
  /** Contas com falha (404, etc.) */
  contasComErro?: string[]
}

function parseHandlesList(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.replace(/^@/, '').trim())
    .filter(Boolean)
}

export function resolverHandlesTwitter(): string[] {
  const completo = process.env.TWITTER_USERNAMES?.trim()
  if (completo) {
    return [...new Set(parseHandlesList(completo))]
  }
  const extra = parseHandlesList(process.env.TWITTER_EXTRA_USERNAMES)
  return [...new Set([...TWITTER_HANDLES_PADRAO, ...extra])]
}

function strictOnly(): boolean {
  return process.env.TWITTER_STRICT_ONLY === '1' || process.env.TWITTER_STRICT_ONLY === 'true'
}

/** Remove t.co e espaços extra; mantém @mentions. */
export function limparTextoTweet(texto: string): string {
  let t = texto.replace(/https?:\/\/t\.co\/\w+/gi, '').replace(/\s+/g, ' ').trim()
  if (t.length > 560) t = t.slice(0, 557).trim() + '…'
  return t
}

function ativosDoTweet(full: string, cat: InsightNoticia['categoria']): InsightNoticia['ativos'] {
  const out = new Set<InsightNoticia['ativos'][number]>()
  if (/\b(bitcoin|btc)\b/i.test(full)) out.add('BTC')
  if (/\b(ethereum|ether|\beth\b)\b/i.test(full)) out.add('ETH')
  if (/\b(altcoin|solana|xrp|bnb|doge)\b/i.test(full)) out.add('ALTCOINS')
  if (cat === 'GEOPOLÍTICA' || cat === 'MACRO' || out.size === 0) out.add('MERCADO GLOBAL')
  return Array.from(out)
}

/** Incluir tweet: filtro estrito OU (modo normal) relaxado para contas do feed. */
function incluirTweetNoFeed(limpo: string): boolean {
  if (limpo.length < 12) return false
  const { relevanteParaFeed } = analisarTextoMercado(limpo)
  if (relevanteParaFeed) return true
  if (strictOnly()) return false
  if (limpo.length >= 28 && RE_RELAXADO.test(limpo)) return true
  /* Posts longos sem palavra-chave (ex. política geral) — máx. controlo por conta no loop */
  if (limpo.length >= 55) return true
  return false
}

async function twitterFetch<T>(
  path: string,
  token: string,
  searchParams: Record<string, string>
): Promise<{ ok: boolean; data: T; status: number }> {
  const url = new URL(`${TWITTER_API}${path}`)
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 18_000)
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: controller.signal,
    })
    const data = (await res.json()) as T
    return { ok: res.ok, data, status: res.status }
  } finally {
    clearTimeout(timer)
  }
}

interface TwitterUser {
  data?: { id: string; name: string; username: string }
  errors?: { detail?: string; title?: string }[]
}

interface TwitterTweets {
  data?: { id: string; text: string; created_at?: string }[]
  errors?: { detail?: string; title?: string }[]
}

export async function buscarTweetsMercado(bearerToken: string): Promise<TwitterFeedResult> {
  const handles = resolverHandlesTwitter()
  if (!bearerToken.trim()) {
    return {
      tweets: [],
      handlesSeguidos: handles,
      ativo: false,
      aviso: 'sem_token',
      mensagem:
        'O X não está ligado: falta TWITTER_BEARER_TOKEN no servidor (Vercel → Settings → Environment Variables).',
    }
  }

  const tweets: TweetMercadoItem[] = []
  const contasComErro: string[] = []
  let tokenInvalido = false
  let semPermissao = false
  let rateLimit = false
  let utilizadoresOk = 0

  for (const username of handles) {
    const userRes = await twitterFetch<TwitterUser>(
      `/users/by/username/${encodeURIComponent(username)}`,
      bearerToken,
      { 'user.fields': 'name,username' }
    )

    if (userRes.status === 401) {
      tokenInvalido = true
      break
    }
    if (userRes.status === 403) {
      semPermissao = true
      break
    }
    if (userRes.status === 429) {
      rateLimit = true
      break
    }

    if (!userRes.ok || !userRes.data.data?.id) {
      contasComErro.push(username)
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[twitter] @${username}`, userRes.status, userRes.data)
      }
      continue
    }

    utilizadoresOk++
    const { id: userId, name: autorNome, username: autorHandle } = userRes.data.data

    const twRes = await twitterFetch<TwitterTweets>(`/users/${userId}/tweets`, bearerToken, {
      max_results: '10',
      exclude: 'retweets,replies',
      'tweet.fields': 'created_at',
    })

    if (twRes.status === 401) {
      tokenInvalido = true
      break
    }
    if (twRes.status === 403) {
      semPermissao = true
      break
    }
    if (twRes.status === 429) {
      rateLimit = true
      break
    }

    if (!twRes.ok || !Array.isArray(twRes.data.data)) {
      contasComErro.push(`${username}(tweets)`)
      continue
    }

    let aceites = 0
    let longosGenericos = 0
    const maxPorConta = 5
    const maxLongosGenericos = 2

    for (const tw of twRes.data.data) {
      if (aceites >= maxPorConta) break
      const limpo = limparTextoTweet(tw.text)
      const analise = analisarTextoMercado(limpo)

      if (!incluirTweetNoFeed(limpo)) continue

      if (!analise.relevanteParaFeed && limpo.length >= 55 && !RE_RELAXADO.test(limpo)) {
        if (longosGenericos >= maxLongosGenericos) continue
        longosGenericos++
      }

      const dataIso = tw.created_at
        ? new Date(tw.created_at).toISOString()
        : new Date().toISOString()

      tweets.push({
        id: tw.id,
        tipo: 'tweet',
        texto: limpo,
        autorNome,
        autorHandle,
        url: `https://x.com/${autorHandle}/status/${tw.id}`,
        dataPublicacao: dataIso,
        categoria: analise.categoria,
        impacto: analise.impacto,
        ativos: ativosDoTweet(analise.normalizado, analise.categoria),
      })
      aceites++
    }

    await new Promise((r) => setTimeout(r, 150))
  }

  tweets.sort((a, b) => new Date(b.dataPublicacao).getTime() - new Date(a.dataPublicacao).getTime())
  const tweetsOut = tweets.slice(0, 45)

  let aviso: TwitterFeedResult['aviso'] = 'ok'
  let mensagem: string | undefined

  if (tokenInvalido) {
    aviso = 'token_invalido'
    mensagem =
      'Bearer Token do X inválido ou expirado. Gera um novo em developer.twitter.com → Keys and tokens.'
  } else if (semPermissao) {
    aviso = 'sem_permissao'
    mensagem =
      'O projeto do X não tem permissão para ler timelines (erro 403). No Developer Portal ativa OAuth 2.0 e o nível de acesso que inclua “Read” de tweets, ou subscreve um plano com acesso à API v2.'
  } else if (rateLimit) {
    aviso = 'rate_limit'
    mensagem = 'Limite de pedidos da API do X atingido. Espera alguns minutos e carrega em Atualizar.'
  } else if (tweetsOut.length === 0 && utilizadoresOk === 0 && contasComErro.length > 0) {
    aviso = 'ok'
    mensagem = `Nenhuma conta resolvida. Verifica os @: ${contasComErro.map((c) => `@${c.replace('(tweets)', '')}`).join(', ')} — podem estar errados ou suspensos.`
  } else if (tweetsOut.length === 0 && utilizadoresOk > 0) {
    mensagem =
      'A API do X respondeu mas não há tweets recentes que passem o filtro. Tenta TWITTER_STRICT_ONLY=0 (predefinição) ou aumenta atividade nas contas.'
  }

  return {
    tweets: tweetsOut,
    handlesSeguidos: handles,
    ativo: true,
    aviso,
    mensagem,
    contasComErro: contasComErro.length ? contasComErro : undefined,
  }
}
