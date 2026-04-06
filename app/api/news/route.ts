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

const AVISO_SEM_FONTES =
  'Sem notícias: adiciona NEWSDATA_API_KEY e/ou CRYPTOPANIC_AUTH_TOKEN nas Environment Variables do projeto na Vercel (Settings → Environment Variables), faz redeploy, e espera ~1 min.'

const AVISO_SEM_ARTIGOS =
  'O feed veio vazio neste momento. A fonte pode estar sem artigos recentes/temporariamente limitada; tenta atualizar em 1-2 minutos. Para reforçar volume, usa também CRYPTOPANIC_AUTH_TOKEN.'

/** Agrega fetch + processamento + tradução; cacheia ~45s para vários utilizadores não repetirem o trabalho. */
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
      traduzirNoticiasRapido(processadas),
      new Promise<NoticiaProcessada[]>((resolve) =>
        setTimeout(() => resolve(processadas), 28_000)
      ),
    ])
    return { traduzidas }
  },
  ['api-news-montar-v13'],
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
