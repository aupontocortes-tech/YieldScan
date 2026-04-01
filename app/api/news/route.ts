import { NextRequest, NextResponse } from 'next/server'
import { paraJsonInsights, pegarTodasNoticias, processarNoticias } from '@/lib/newsdata'
import type { NoticiaProcessada } from '@/lib/newsdata'
import { traduzirParaPortugues } from '@/lib/translate'

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

/* ── Tradução sequencial (respeita limite/dia da API gratuita) ─────────── */
/** NewsData usa nomes completos ('portuguese', 'english') — normaliza para código ISO. */
function normalizarLang(lang: string | null): string {
  if (!lang) return 'pt'
  const l = lang.toLowerCase()
  if (l === 'portuguese' || l.startsWith('pt')) return 'pt'
  if (l === 'english' || l.startsWith('en')) return 'en'
  if (l === 'spanish' || l.startsWith('es')) return 'es'
  if (l === 'french' || l.startsWith('fr')) return 'fr'
  // Para qualquer outro, assume código ISO de 2 chars
  return l.slice(0, 2)
}

async function traduzirNoticias(
  processadas: NoticiaProcessada[]
): Promise<NoticiaProcessada[]> {
  const out: NoticiaProcessada[] = []
  for (const n of processadas) {
    const lang = normalizarLang(n.linguagem)
    if (lang === 'pt') {
      out.push(n)
    } else {
      const [titulo, resumo] = await Promise.all([
        traduzirParaPortugues(n.titulo, lang),
        traduzirParaPortugues(n.resumo, lang),
      ])
      out.push({ ...n, titulo, resumo })
    }
  }
  return out
}

/* ── Handler ────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  if (!permitir(clientId(req))) {
    return NextResponse.json(
      { erro: 'Muitas tentativas. Aguarda um minuto e tenta de novo.', noticias: [], insights: [] },
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
          insights: [],
        },
        { status: 503 }
      )
    }

    const { results, erro: erroApi } = await pegarTodasNoticias(key)

    if (erroApi === 'sem_artigos') {
      return NextResponse.json(
        { erro: 'Não foi possível obter notícias. Verifica a chave API ou o plano na NewsData.', noticias: [], insights: [] },
        { status: 502 }
      )
    }

    const processadas = processarNoticias(results)

    /* Traduz artigos que não estejam em PT (com timeout de segurança de 18s) */
    const traduzidas = await Promise.race([
      traduzirNoticias(processadas),
      new Promise<NoticiaProcessada[]>((resolve) =>
        setTimeout(() => resolve(processadas), 18_000)
      ),
    ])

    return NextResponse.json(
      {
        totalResults: traduzidas.length,
        noticias: traduzidas,
        insights: paraJsonInsights(traduzidas),
      },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
          'CDN-Cache-Control': 'no-store',
          'Vercel-CDN-Cache-Control': 'no-store',
        },
      }
    )
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.error('[api/news]', e)
    return NextResponse.json(
      { erro: 'Erro interno ao processar notícias.', noticias: [], insights: [] },
      { status: 500 }
    )
  }
}
