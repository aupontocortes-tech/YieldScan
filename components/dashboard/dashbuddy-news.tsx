'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Bitcoin, ExternalLink, Globe, Newspaper, RefreshCw, TrendingUp } from 'lucide-react'
import type React from 'react'
import type { InsightNoticia, NoticiaProcessada } from '@/lib/newsdata'
import { cn } from '@/lib/utils'

/* ── Types ─────────────────────────────────────────────────────────────── */
interface NewsPayload {
  erro?: string
  totalResults?: number
  noticias: NoticiaProcessada[]
  insights: InsightNoticia[]
}

/* ── Data ───────────────────────────────────────────────────────────────── */
async function fetchNoticias(): Promise<NewsPayload> {
  const res = await fetch('/api/news', { cache: 'no-store' })
  const json = (await res.json()) as NewsPayload
  if (!res.ok && !json.erro) throw new Error('Erro ao carregar notícias.')
  return json
}

/* ── Filters ─────────────────────────────────────────────────────────────── */
const FILTROS = [
  { label: 'Todos', value: 'todos' },
  { label: 'Cripto', value: 'CRIPTO' },
  { label: 'Geopolítica', value: 'GEOPOLÍTICA' },
  { label: 'Macro', value: 'MACRO' },
] as const

type Filtro = (typeof FILTROS)[number]['value']

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

const GRADIENTE_CAT: Record<InsightNoticia['categoria'], string> = {
  CRIPTO: 'from-cyan-500/25 via-blue-950/80 to-card',
  GEOPOLÍTICA: 'from-amber-500/25 via-orange-950/80 to-card',
  MACRO: 'from-yellow-500/25 via-yellow-950/80 to-card',
}

const ICONE_CAT: Record<InsightNoticia['categoria'], React.ReactNode> = {
  CRIPTO: <Bitcoin className="h-10 w-10 opacity-20" />,
  GEOPOLÍTICA: <Globe className="h-10 w-10 opacity-20" />,
  MACRO: <TrendingUp className="h-10 w-10 opacity-20" />,
}

const BADGE_CAT: Record<InsightNoticia['categoria'], string> = {
  CRIPTO: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300',
  GEOPOLÍTICA: 'border-amber-400/40 bg-amber-500/15 text-amber-300',
  MACRO: 'border-yellow-400/40 bg-yellow-500/15 text-yellow-300',
}

const LABEL_CAT: Record<InsightNoticia['categoria'], string> = {
  CRIPTO: 'Cripto',
  GEOPOLÍTICA: 'Geopolítica',
  MACRO: 'Macro',
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */
function NewsCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/50">
      <Skeleton className="h-44 w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex justify-between pt-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  )
}

/* ── NewsCard ─────────────────────────────────────────────────────────────── */
function NewsCard({ n }: { n: NoticiaProcessada }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgErr, setImgErr] = useState(false)
  const hasImg = Boolean(n.imagemUrl && !imgErr)
  const hasLink = n.link && n.link !== '#'

  return (
    <a
      href={hasLink ? n.link : undefined}
      target={hasLink ? '_blank' : undefined}
      rel={hasLink ? 'noopener noreferrer' : undefined}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm',
        'transition-all duration-200 hover:-translate-y-0.5 hover:border-yellow-500/30',
        'hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)]',
        hasLink ? 'cursor-pointer' : 'cursor-default'
      )}
    >
      {/* ── Image / gradient header ── */}
      <div className="relative h-44 w-full overflow-hidden shrink-0">
        {/* Gradient always visible as base */}
        <div className={cn('absolute inset-0 bg-gradient-to-br', GRADIENTE_CAT[n.categoria])} />
        {/* Category icon when no image */}
        {!hasImg && (
          <div className="absolute inset-0 flex items-center justify-center">
            {ICONE_CAT[n.categoria]}
          </div>
        )}
        {/* Image fades in on top of gradient once loaded */}
        {hasImg && (
          <img
            src={n.imagemUrl!}
            alt=""
            loading="lazy"
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover:scale-105',
              imgLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgErr(true)}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card/95 to-transparent" />

        {/* Category badge */}
        <div className="absolute bottom-3 left-3">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md',
              BADGE_CAT[n.categoria]
            )}
          >
            {LABEL_CAT[n.categoria]}
          </span>
        </div>

        {/* Impact pill */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-border/40 bg-background/75 px-2.5 py-1 backdrop-blur-sm">
          <span className={cn('h-1.5 w-1.5 rounded-full', COR_IMPACTO[n.impacto])} />
          <span className="text-[10px] font-medium text-foreground/90">
            {LABEL_IMPACTO[n.impacto]}
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-yellow-400">
          {n.titulo}
        </h3>
        <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">
          {n.resumo}
        </p>

        {/* Assets */}
        {n.ativos.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {n.ativos.map((a) => (
              <span
                key={a}
                className="rounded-md bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/80"
              >
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-end justify-between border-t border-border/30 pt-3 mt-auto">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-muted-foreground">{n.fonte}</p>
            {n.dataPublicacao && (
              <p className="text-[10px] text-muted-foreground/60">{formatarData(n.dataPublicacao)}</p>
            )}
          </div>
          {hasLink && (
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-yellow-400" />
          )}
        </div>
      </div>
    </a>
  )
}

/* ── Main component ──────────────────────────────────────────────────────── */
export function DashbuddyNews() {
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashbuddy-news'],
    queryFn: fetchNoticias,
    retry: 1,
    staleTime: 60_000,
  })

  const noticias = data?.noticias ?? []
  const isConfigError = Boolean(data?.erro?.includes('NEWSDATA_API_KEY'))
  const apiErro = data?.erro && !isConfigError ? data.erro : null

  const noticiasFiltradas = useMemo(() => {
    if (filtro === 'todos') return noticias
    return noticias.filter((n) => n.categoria === filtro)
  }, [noticias, filtro])

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Newspaper className="h-5 w-5 text-yellow-400" />
            <h2 className="text-2xl font-bold tracking-tight">Notícias do Mercado</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            NewsData.io · em português · classificação automática
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

      {/* ── Filter chips ── */}
      {!isConfigError && !isError && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
          {FILTROS.map((f) => {
            const count =
              f.value === 'todos'
                ? noticias.length
                : noticias.filter((n) => n.categoria === f.value).length
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFiltro(f.value)}
                className={cn(
                  'shrink-0 flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
                  filtro === f.value
                    ? 'border-yellow-500 bg-yellow-500 text-black shadow-sm'
                    : 'border-border/60 bg-card/50 text-muted-foreground hover:border-yellow-500/40 hover:text-foreground'
                )}
              >
                {f.label}
                {!isLoading && count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums',
                      filtro === f.value
                        ? 'bg-black/20 text-black'
                        : 'bg-muted/60 text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Config error ── */}
      {isConfigError && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6 text-center">
          <p className="font-semibold text-yellow-400">Chave API não configurada</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Adiciona{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">NEWSDATA_API_KEY=tua_chave</code>{' '}
            no ficheiro{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">.env.local</code> e
            reinicia o servidor.
          </p>
        </div>
      )}

      {/* ── API error ── */}
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

      {/* ── Skeletons ── */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && !isError && !apiErro && !isConfigError && noticiasFiltradas.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/40 bg-card/30 py-20 text-center">
          <Newspaper className="h-10 w-10 opacity-20" />
          <div>
            <p className="font-medium">Nenhuma notícia encontrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtro !== 'todos'
                ? 'Tenta outro filtro ou actualiza.'
                : 'Actualiza para tentar de novo.'}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
        </div>
      )}

      {/* ── News grid ── */}
      {!isLoading && noticiasFiltradas.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {noticiasFiltradas.map((n, i) => (
            <NewsCard key={n.articleId ?? `${n.link}-${i}`} n={n} />
          ))}
        </div>
      )}
    </div>
  )
}
