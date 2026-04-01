/**
 * Twitter / X API v2 (Bearer Token, app-only).
 * Variáveis: TWITTER_BEARER_TOKEN (obrigatório para tweets)
 * TWITTER_USERNAMES — lista completa (substitui defaults) sem @, separada por vírgula
 * TWITTER_EXTRA_USERNAMES — acrescenta contas às predefinidas
 *
 * Defaults: Trump, conta estilo headlines Bloomberg (DeItaone), Watcher.Guru, Arthur Reis.
 */

import { analisarTextoMercado, type InsightNoticia } from '@/lib/newsdata'

const TWITTER_API = 'https://api.twitter.com/2'

/** Contas base pedidas pelo produto (handles sem @). Walter Bloomberg → @DeItaone (headlines mercado). */
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

export interface TwitterFeedResult {
  tweets: TweetMercadoItem[]
  handlesSeguidos: string[]
  ativo: boolean
  aviso?: string
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

/** Remove t.co e espaços extra; mantém @mentions (contexto). */
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

async function twitterFetch<T>(
  path: string,
  token: string,
  searchParams: Record<string, string>
): Promise<{ ok: boolean; data: T; status: number }> {
  const url = new URL(`${TWITTER_API}${path}`)
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
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
  errors?: { detail?: string }[]
}

interface TwitterTweets {
  data?: { id: string; text: string; created_at?: string }[]
  meta?: { result_count?: number }
  errors?: { detail?: string }[]
}

/**
 * Busca tweets recentes por utilizador, filtra por relevância mercado/cripto/geo.
 * Máx. ~3 tweets relevantes por conta (para poupar rate limit).
 */
export async function buscarTweetsMercado(bearerToken: string): Promise<TwitterFeedResult> {
  const handles = resolverHandlesTwitter()
  if (!bearerToken.trim()) {
    return { tweets: [], handlesSeguidos: handles, ativo: false, aviso: 'sem_token' }
  }

  const tweets: TweetMercadoItem[] = []

  for (const username of handles) {
    const userRes = await twitterFetch<TwitterUser>(
      `/users/by/username/${encodeURIComponent(username)}`,
      bearerToken,
      { 'user.fields': 'name,username' }
    )
    if (!userRes.ok || !userRes.data.data?.id) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[twitter] user @${username}:`, userRes.status, userRes.data)
      }
      continue
    }
    const { id: userId, name: autorNome, username: autorHandle } = userRes.data.data

    const twRes = await twitterFetch<TwitterTweets>(`/users/${userId}/tweets`, bearerToken, {
      max_results: '10',
      exclude: 'retweets,replies',
      'tweet.fields': 'created_at',
    })

    if (!twRes.ok || !Array.isArray(twRes.data.data)) continue

    let aceites = 0
    const maxPorConta = 4
    for (const tw of twRes.data.data) {
      if (aceites >= maxPorConta) break
      const limpo = limparTextoTweet(tw.text)
      if (limpo.length < 12) continue
      const { categoria, impacto, relevanteParaFeed, normalizado } = analisarTextoMercado(limpo)
      if (!relevanteParaFeed) continue

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
        categoria,
        impacto,
        ativos: ativosDoTweet(normalizado, categoria),
      })
      aceites++
    }

    await new Promise((r) => setTimeout(r, 120))
  }

  tweets.sort((a, b) => new Date(b.dataPublicacao).getTime() - new Date(a.dataPublicacao).getTime())

  return {
    tweets: tweets.slice(0, 40),
    handlesSeguidos: handles,
    ativo: true,
  }
}
