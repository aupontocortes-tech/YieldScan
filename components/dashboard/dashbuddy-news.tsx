'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NewsSpeakButton } from '@/components/news/news-speak-button'
import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react'
import { noticiasParaFeed, type ItemFeedNoticia } from '@/lib/market-feed'
import type { InsightNoticia, NoticiaProcessada } from '@/lib/newsdata'
import { cn } from '@/lib/utils'

/* ── Types ─────────────────────────────────────────────────────────────── */
interface NewsPayload {
  erro?: string
  totalResults?: number
  noticias: NoticiaProcessada[]
  feed?: ItemFeedNoticia[]
  insights: InsightNoticia[]
}

/* ── Data ───────────────────────────────────────────────────────────────── */
async function fetchNoticias(): Promise<NewsPayload> {
  const res = await fetch('/api/news')
  const json = (await res.json()) as NewsPayload
  if (!res.ok) throw new Error(json.erro ?? 'Erro ao carregar notícias.')
  return json
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function formatarData(pub: string | null): string {
  if (!pub) return ''
  try {
    const d = new Date(pub.replace(' ', 'T'))
    const diff = Date.now() - d.getTime()
    const min = Math.floor(diff / 60_000)
    const h = Math.floor(diff / 3_600_000)
    const dias = Math.floor(diff / 86_400_000)
    if (min < 1) return 'agora'
    if (min < 60) return `há ${min}min`
    if (h < 24) return `há ${h}h`
    if (dias < 7) return `há ${dias}d`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch {
    return ''
  }
}

/* ── Design maps ─────────────────────────────────────────────────────────── */
const COR_IMPACTO: Record<InsightNoticia['impacto'], string> = {
  POSITIVO: 'bg-emerald-500',
  NEGATIVO: 'bg-red-500',
  NEUTRO: 'bg-zinc-500',
}

const LABEL_IMPACTO: Record<InsightNoticia['impacto'], string> = {
  POSITIVO: 'Positivo',
  NEGATIVO: 'Negativo',
  NEUTRO: 'Neutro',
}

const BADGE_CRIPTO = 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'

/* ── Skeletons ────────────────────────────────────────────────────────────── */
function NewsCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/40 bg-card/50">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

/* ── NewsCard: imagem quadrada + texto; sem imagem = só texto ───────────── */
function NewsCard({ n, speechId }: { n: NoticiaProcessada; speechId: string }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgErr, setImgErr] = useState(false)
  const hasImg = Boolean(n.imagemUrl && !imgErr)
  const hasLink = n.link && n.link !== '#'

  const meta = (
    <div className="mt-auto flex items-center justify-between border-t border-border/25 pt-3 text-[10px] text-muted-foreground">
      <span className="min-w-0 truncate">
        {n.fonte}
        {n.dataPublicacao ? ` · ${formatarData(n.dataPublicacao)}` : ''}
      </span>
      {hasLink && (
        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-100" />
      )}
    </div>
  )

  const texto = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold',
            BADGE_CRIPTO
          )}
        >
          Cripto
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', COR_IMPACTO[n.impacto])} />
          {LABEL_IMPACTO[n.impacto]}
        </span>
      </div>
      <h3 className="mt-3 line-clamp-3 text-sm font-semibold leading-snug text-foreground group-hover:text-yellow-400/95">
        {n.titulo}
      </h3>
      <p className="mt-2 line-clamp-5 text-xs leading-relaxed text-muted-foreground">{n.resumo}</p>
      {meta}
    </>
  )

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card/85',
        'transition-all duration-200 hover:border-yellow-500/35 hover:shadow-lg'
      )}
    >
      <a
        href={hasLink ? n.link : undefined}
        target={hasLink ? '_blank' : undefined}
        rel={hasLink ? 'noopener noreferrer' : undefined}
        className={cn(
          'flex min-h-0 flex-1 flex-col outline-none',
          hasLink ? 'cursor-pointer' : 'cursor-default'
        )}
      >
        {hasImg ? (
          <>
            <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-muted/30">
              <img
                src={n.imagemUrl!}
                alt=""
                loading="lazy"
                className={cn(
                  'h-full w-full object-cover transition-opacity duration-500',
                  imgLoaded ? 'opacity-100' : 'opacity-0'
                )}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgErr(true)}
              />
              {!imgLoaded && !imgErr && (
                <div className="absolute inset-0 animate-pulse bg-muted/50" aria-hidden />
              )}
            </div>
            <div className="flex flex-1 flex-col p-4 pb-10">{texto}</div>
          </>
        ) : (
          <div className="flex flex-1 flex-col p-4 pb-10 pt-5">{texto}</div>
        )}
      </a>
      <NewsSpeakButton
        speechId={speechId}
        title={n.titulo}
        description={n.resumo}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 h-9 w-9 text-[17px]"
      />
    </div>
  )
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export function DashbuddyNews() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashbuddy-news'],
    queryFn: fetchNoticias,
    retry: 2,
    retryDelay: 2_000,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })

  const feed = useMemo((): ItemFeedNoticia[] => {
    if (data?.feed && data.feed.length > 0) return data.feed
    return noticiasParaFeed(data?.noticias ?? [])
  }, [data])

  const isConfigError = isError && Boolean(error?.message?.includes('NEWSDATA_API_KEY'))
  const apiErro = isError && !isConfigError ? (error?.message ?? 'Erro ao carregar notícias.') : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Newspaper className="h-5 w-5 text-yellow-400" />
            <h2 className="text-2xl font-bold tracking-tight">Notícias cripto</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Só temas de criptomoedas e blockchain (NewsData + CryptoPanic quando configurado). Títulos e
            resumos em português quando a fonte é noutro idioma; sem imagem na fonte, só texto.
            {!isLoading && !isError && feed.length > 0 && (
              <span className="text-muted-foreground/80"> {feed.length} no feed.</span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 self-start border-yellow-500/30 hover:border-yellow-400/60"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {isConfigError && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6 text-center">
          <p className="font-semibold text-yellow-400">Chave API não configurada</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Adiciona{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">NEWSDATA_API_KEY=tua_chave</code> no
            ficheiro <code className="rounded bg-muted px-1 py-0.5 text-foreground">.env.local</code> (ou na Vercel) e
            reinicia o servidor. Opcional: <code className="rounded bg-muted px-1 py-0.5 text-foreground">CRYPTOPANIC_AUTH_TOKEN</code> para mais artigos.
          </p>
        </div>
      )}

      {(isError || apiErro) && !isConfigError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
          <p className="font-semibold text-red-400">Não foi possível carregar as notícias</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {apiErro ?? (error instanceof Error ? error.message : 'Erro desconhecido.')}
          </p>
          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar de novo
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && !isError && !apiErro && !isConfigError && feed.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/40 bg-card/30 py-20 text-center">
          <Newspaper className="h-10 w-10 opacity-20" />
          <div>
            <p className="font-medium">Nenhuma notícia no momento</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirma <code className="rounded bg-muted px-1">NEWSDATA_API_KEY</code> e o plano na NewsData; define
              também <code className="rounded bg-muted px-1">CRYPTOPANIC_AUTH_TOKEN</code> para reforçar o feed.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
        </div>
      )}

      {!isLoading && feed.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {feed.map((item) => (
            <NewsCard key={item.id} speechId={item.id} n={item.dados} />
          ))}
        </div>
      )}
    </div>
  )
}
