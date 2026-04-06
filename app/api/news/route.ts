import { unstable_cache } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { noticiasParaFeed } from '@/lib/market-feed'
import { paraJsonInsights, pegarTodasNoticias, processarNoticias } from '@/lib/newsdata'
import type { NoticiaProcessada } from '@/lib/newsdata'
import { traduzirNoticiasRapido } from '@/lib/traduzir-noticias'

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

/** Agrega fetch + processamento + tradução; cacheia ~45s para vários utilizadores não repetirem o trabalho. */
const montarNoticiasEmCache = unstable_cache(
  async (): Promise<
    | { ok: true; traduzidas: NoticiaProcessada[] }
    | { ok: false; erro: 'sem_artigos' | 'no_key' }
  > => {
    const key = process.env.NEWSDATA_API_KEY?.trim()
    if (!key) return { ok: false, erro: 'no_key' }
    const { results, erro } = await pegarTodasNoticias(key)
    if (erro === 'sem_artigos') return { ok: false, erro: 'sem_artigos' }
    const processadas = processarNoticias(results)
    const traduzidas = await Promise.race([
      traduzirNoticiasRapido(processadas),
      new Promise<NoticiaProcessada[]>((resolve) =>
        setTimeout(() => resolve(processadas), 28_000)
      ),
    ])
    return { ok: true, traduzidas }
  },
  ['api-news-montar-v9'],
  { revalidate: 45, tags: ['news'] }
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
    const key = process.env.NEWSDATA_API_KEY
    if (!key?.trim()) {
      return NextResponse.json(
        {
          erro: 'NEWSDATA_API_KEY não configurada. Define a chave em .env.local na raiz do projeto.',
          noticias: [],
          feed: [],
          insights: [],
        },
        { status: 503 }
      )
    }

    const payload = await montarNoticiasEmCache()

    if (!payload.ok && payload.erro === 'sem_artigos') {
      return NextResponse.json(
        {
          erro: 'Não foi possível obter notícias. Verifica a chave API ou o plano na NewsData.',
          noticias: [],
          feed: [],
          insights: [],
        },
        { status: 502 }
      )
    }

    if (!payload.ok) {
      return NextResponse.json(
        {
          erro: 'NEWSDATA_API_KEY não configurada. Define a chave em .env.local na raiz do projeto.',
          noticias: [],
          feed: [],
          insights: [],
        },
        { status: 503 }
      )
    }

    const { traduzidas } = payload
    const feed = noticiasParaFeed(traduzidas)

    return NextResponse.json(
      {
        totalResults: traduzidas.length,
        noticias: traduzidas,
        feed,
        insights: paraJsonInsights(traduzidas),
      },
      {
        headers: {
          'Cache-Control':
            'public, s-maxage=45, stale-while-revalidate=120',
          'CDN-Cache-Control': 'public, s-maxage=45, stale-while-revalidate=120',
          'Vercel-CDN-Cache-Control': 'public, s-maxage=45, stale-while-revalidate=120',
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
