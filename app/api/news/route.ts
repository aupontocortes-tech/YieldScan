import { unstable_cache } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { noticiasParaFeed } from '@/lib/market-feed'
import {
  NEWS_CDN_S_MAXAGE_SECONDS,
  NEWS_CDN_STALE_WHILE_REVALIDATE_SECONDS,
  NEWS_SERVER_REVALIDATE_SECONDS,
} from '@/lib/news-refresh-config'
import { paraJsonInsights, pegarTodasNoticias, processarNoticias } from '@/lib/newsdata'
import type { NoticiaProcessada } from '@/lib/newsdata'
import { traduzirNoticiasRapido, parecePortugues } from '@/lib/traduzir-noticias'

export const dynamic = 'force-dynamic'

/* ── Rate limit simples por IP ─────────────────────────────────────────── */
const WINDOW_MS = 60_000
const MAX_REQ = 40
const bucket = new Map<string, { count: number; ts: number }>()

function clientId(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'local'
  )
}

function permitir(id: string): boolean {
  const now = Date.now()
  const b = bucket.get(id)
  if (!b || now - b.ts > WINDOW_MS) {
    bucket.set(id, { count: 1, ts: now })
    if (bucket.size > 400) {
      for (const [k, v] of bucket) if (now - v.ts > WINDOW_MS * 2) bucket.delete(k)
    }
    return true
  }
  if (b.count >= MAX_REQ) return false
  b.count++
  return true
}

function parecePortuguesFeed(n: NoticiaProcessada): boolean {
  if (n.linguagem === 'pt') return true
  return parecePortugues(`${n.titulo} ${n.resumo}`)
}

const AVISO_IDIOMA_ORIGINAL =
  'Algumas notícias ainda estão no idioma original: a tradução automática atingiu o limite diário. Define MYMEMORY_EMAIL na Vercel para mais quota, ou aguarda ~1 min e actualiza.'

function temTituloEResumo(n: NoticiaProcessada): boolean {
  const t = (n.titulo ?? '').trim()
  const r = (n.resumo ?? '').trim() || t
  return Boolean(t && r)
}

const AVISO_SEM_FONTES =
  'Sem notícias: adiciona COINDESK_API_KEY (recomendado para cripto), GNEWS_API_KEY, NEWSDATA_API_KEY e/ou CRYPTOPANIC_AUTH_TOKEN nas Environment Variables do projeto na Vercel (Settings → Environment Variables), faz redeploy, e espera ~1 min.'

const AVISO_SEM_ARTIGOS =
  'O feed veio vazio neste momento. A fonte pode estar sem artigos recentes/temporariamente limitada; tenta atualizar em 1-2 minutos. Para reforçar volume, usa também CRYPTOPANIC_AUTH_TOKEN.'

/** Agrega fetch + processamento + tradução; ver `lib/news-refresh-config.ts` / `NEWS_SERVER_REVALIDATE_SECONDS`. */
const montarNoticiasEmCache = unstable_cache(
  async (): Promise<{ traduzidas: NoticiaProcessada[]; aviso?: string }> => {
    const { results, erro } = await pegarTodasNoticias(process.env.NEWSDATA_API_KEY)
    if (!results.length) {
      return {
        traduzidas: [],
        aviso: erro === 'sem_fontes' ? AVISO_SEM_FONTES : AVISO_SEM_ARTIGOS,
      }
    }
    const processadas = processarNoticias(results)
    const traduzidas = await Promise.race([
      traduzirNoticiasRapido(processadas, { maxTraduzir: 18, loteParalelo: 5 }),
      new Promise<NoticiaProcessada[]>((resolve) =>
        setTimeout(() => resolve(processadas), 12_000),
      ),
    ])
    const normalizadas = traduzidas.map((n) => ({
      ...n,
      titulo: (n.titulo ?? '').trim(),
      resumo: (n.resumo ?? '').trim() || (n.titulo ?? '').trim(),
    }))
    const curadas = normalizadas.filter((n) => n.titulo && n.resumo && parecePortuguesFeed(n))
    const comConteudo = normalizadas.filter(temTituloEResumo)
    if (curadas.length > 0) {
      return { traduzidas: curadas }
    }
    if (comConteudo.length > 0) {
      return { traduzidas: comConteudo, aviso: AVISO_IDIOMA_ORIGINAL }
    }
    return { traduzidas: [], aviso: AVISO_SEM_ARTIGOS }
  },
  ['api-news-montar-v22'],
  { revalidate: NEWS_SERVER_REVALIDATE_SECONDS, tags: ['news'] }
)

/* ── Handler ────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  if (!permitir(clientId(req))) {
    return NextResponse.json(
      {
        erro: 'Muitas tentativas. Aguarda um minuto e tenta de novo.',
        noticias: [],
        feed: [],
        insights: [],
      },
      { status: 429 }
    )
  }

  try {
    const { traduzidas, aviso } = await montarNoticiasEmCache()
    const feed = noticiasParaFeed(traduzidas)

    return NextResponse.json(
      {
        totalResults: traduzidas.length,
        noticias: traduzidas,
        feed,
        insights: paraJsonInsights(traduzidas),
        ...(aviso ? { aviso } : {}),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': `public, s-maxage=${NEWS_CDN_S_MAXAGE_SECONDS}, stale-while-revalidate=${NEWS_CDN_STALE_WHILE_REVALIDATE_SECONDS}`,
          'CDN-Cache-Control': `public, s-maxage=${NEWS_CDN_S_MAXAGE_SECONDS}, stale-while-revalidate=${NEWS_CDN_STALE_WHILE_REVALIDATE_SECONDS}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${NEWS_CDN_S_MAXAGE_SECONDS}, stale-while-revalidate=${NEWS_CDN_STALE_WHILE_REVALIDATE_SECONDS}`,
        },
      }
    )
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.error('[api/news]', e)
    return NextResponse.json(
      {
        erro: 'Erro interno ao processar notícias.',
        noticias: [],
        feed: [],
        insights: [],
      },
      { status: 500 }
    )
  }
}
