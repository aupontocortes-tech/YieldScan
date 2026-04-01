'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Bitcoin, ExternalLink, Globe, Newspaper, RefreshCw, TrendingUp } from 'lucide-react'
import type React from 'react'
import type { ItemFeedMercado } from '@/lib/market-feed'
import type { InsightNoticia, NoticiaProcessada } from '@/lib/newsdata'
import type { TweetMercadoItem } from '@/lib/twitter-feed'
import { cn } from '@/lib/utils'

/* ── Types ─────────────────────────────────────────────────────────────── */
interface NewsPayload {
  erro?: string
  totalResults?: number
  noticias: NoticiaProcessada[]
  tweets?: TweetMercadoItem[]
  feed?: ItemFeedMercado[]
  twitter?: {
    ativo: boolean
    handlesSeguidos: string[]
    aviso: string | null
    mensagem?: string | null
    contasComErro?: string[] | null
    tweetsCount?: number
  }
  insights: InsightNoticia[]
}

/* ── Data ───────────────────────────────────────────────────────────────── */
async function fetchNoticias(): Promise<NewsPayload> {
  const res = await fetch('/api/news', { cache: 'no-store' })
  const json = (await res.json()) as NewsPayload
  if (!res.ok) throw new Error(json.erro ?? 'Erro ao carregar notícias.')
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

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase()
  return nome.slice(0, 2).toUpperCase()
}

function categoriaDoItem(item: ItemFeedMercado): InsightNoticia['categoria'] {
  return item.tipo === 'noticia' ? item.dados.categoria : item.dados.categoria
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

/* ── Skeletons ────────────────────────────────────────────────────────────── */
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

function TweetCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-950/40 to-card/80 p-4">
      <div className="flex gap-3">
        <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
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
      <div className="relative h-44 w-full overflow-hidden shrink-0">
        <div className={cn('absolute inset-0 bg-gradient-to-br', GRADIENTE_CAT[n.categoria])} />
        {!hasImg && (
          <div className="absolute inset-0 flex items-center justify-center">{ICONE_CAT[n.categoria]}</div>
        )}
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
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-border/40 bg-background/75 px-2.5 py-1 backdrop-blur-sm">
          <span className={cn('h-1.5 w-1.5 rounded-full', COR_IMPACTO[n.impacto])} />
          <span className="text-[10px] font-medium text-foreground/90">{LABEL_IMPACTO[n.impacto]}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-yellow-400">
          {n.titulo}
        </h3>
        <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">{n.resumo}</p>
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
        <div className="flex items-end justify-between border-t border-border/30 pt-3 mt-auto">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-yellow-500/70">Artigo</p>
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

/* ── TweetCard (X) ────────────────────────────────────────────────────────── */
function TweetCard({ t }: { t: TweetMercadoItem }) {
  const cat = t.categoria
  return (
    <a
      href={t.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-card/70 backdrop-blur-sm',
        'border-sky-500/25 shadow-[inset_0_1px_0_0_rgba(56,189,248,0.12)]',
        'transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/45',
        'hover:shadow-[0_12px_40px_-12px_rgba(14,165,233,0.25)]'
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-y-3 left-0 w-1 rounded-full bg-gradient-to-b',
          cat === 'CRIPTO' && 'from-cyan-400 to-blue-600',
          cat === 'GEOPOLÍTICA' && 'from-amber-400 to-orange-600',
          cat === 'MACRO' && 'from-yellow-400 to-amber-600'
        )}
      />
      <div className="relative flex flex-1 flex-col gap-3 p-4 pl-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
              'border-sky-500/35 bg-gradient-to-br from-sky-500/20 to-slate-900/80 text-sky-200'
            )}
          >
            {iniciais(t.autorNome)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{t.autorNome}</span>
              <span className="text-muted-foreground/80 text-xs">@{t.autorHandle}</span>
              <span
                className="ml-auto rounded bg-sky-500/15 px-1.5 py-px text-[10px] font-bold tracking-tight text-sky-300 ring-1 ring-sky-500/30"
                aria-hidden
              >
                𝕏
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/95 whitespace-pre-wrap">{t.texto}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold',
              BADGE_CAT[cat]
            )}
          >
            {LABEL_CAT[cat]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 text-[10px]">
            <span className={cn('h-1.5 w-1.5 rounded-full', COR_IMPACTO[t.impacto])} />
            {LABEL_IMPACTO[t.impacto]}
          </span>
          {t.ativos.map((a) => (
            <span
              key={a}
              className="rounded-md bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/80"
            >
              {a}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border/30 pt-2">
          <span className="text-[10px] text-muted-foreground/70">Post no X · {formatarData(t.dataPublicacao)}</span>
          <span className="flex items-center gap-1 text-[10px] font-medium text-sky-400/90 group-hover:text-sky-300">
            Abrir
            <ExternalLink className="h-3 w-3" />
          </span>
        </div>
      </div>
    </a>
  )
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export function DashbuddyNews() {
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashbuddy-news'],
    queryFn: fetchNoticias,
    retry: 2,
    retryDelay: 2_000,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (isError || (data && (data as NewsPayload & { erro?: string }).erro)) {
      void refetch()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const feed = useMemo((): ItemFeedMercado[] => {
    if (data?.feed && data.feed.length > 0) return data.feed
    const n = data?.noticias ?? []
    return n.map((item) => ({
      tipo: 'noticia' as const,
      id: `n-${item.articleId ?? item.link}`,
      ordenadoEm: item.dataPublicacao ?? '',
      dados: item,
    }))
  }, [data])

  const isConfigError = isError && Boolean(error?.message?.includes('NEWSDATA_API_KEY'))
  const apiErro = isError && !isConfigError ? (error?.message ?? 'Erro ao carregar notícias.') : null

  const feedFiltrado = useMemo(() => {
    if (filtro === 'todos') return feed
    return feed.filter((item) => categoriaDoItem(item) === filtro)
  }, [feed, filtro])

  const twitterAtivo = data?.twitter?.ativo === true
  const handles = data?.twitter?.handlesSeguidos ?? []
  const twMsg = data?.twitter?.mensagem ?? null
  const twAviso = data?.twitter?.aviso ?? null
  const twCount = data?.twitter?.tweetsCount ?? data?.tweets?.length ?? 0
  const twErroApi = twAviso === 'token_invalido' || twAviso === 'sem_permissao' || twAviso === 'rate_limit'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Newspaper className="h-5 w-5 text-yellow-400" />
            <h2 className="text-2xl font-bold tracking-tight">Notícias do Mercado</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Um só feed: <span className="text-foreground/85">artigos</span> (cripto, geopolítica, macro) +{' '}
            <span className="text-foreground/85">posts do X</span> das tuas contas, ordenados do mais recente.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/75 max-w-2xl">
            Os <strong className="text-muted-foreground">cartões com imagem</strong> são notícias de media. Os{' '}
            <strong className="text-muted-foreground">cartões com barra azul e 𝕏</strong> são o texto publicado no X.
            Filtros <em>Todos / Cripto / Geopolítica / Macro</em> aplicam-se aos dois tipos.
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

      {!isConfigError && !isError && data && twErroApi && twMsg && (
        <div className="rounded-2xl border border-red-500/35 bg-red-950/30 p-4">
          <p className="text-sm font-semibold text-red-300">Problema com a API do X</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{twMsg}</p>
        </div>
      )}

      {!isConfigError && !isError && data && twitterAtivo && twCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200/90">
          <span className="font-semibold text-emerald-300">X ligado</span>
          <span className="text-muted-foreground">·</span>
          <span>{twCount} post{twCount !== 1 ? 's' : ''} no feed agora</span>
        </div>
      )}

      {!isConfigError && !isError && data && twitterAtivo && twCount === 0 && twMsg && !twErroApi && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/25 p-4">
          <p className="text-sm font-semibold text-amber-200">Posts do X</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{twMsg}</p>
        </div>
      )}

      {!isConfigError && !isError && data && !twitterAtivo && (
        <div className="rounded-2xl border border-sky-500/25 bg-gradient-to-r from-sky-950/50 via-card/80 to-indigo-950/40 p-5 shadow-[inset_0_1px_0_0_rgba(56,189,248,0.15)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-sky-200">Opcional: mostrar posts do X no mesmo feed</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-xl">
                As notícias escritas já funcionam com <code className="rounded bg-muted/80 px-1">NEWSDATA_API_KEY</code>.
                Para juntar os tweets das contas que escolheste, falta só o token do X. Eu não consigo criá-lo por ti:
                vai a{' '}
                <a
                  href="https://developer.twitter.com/en/portal/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-300 underline underline-offset-2"
                >
                  developer.twitter.com
                </a>
                , criar um projeto com acesso de leitura a tweets, copiar o{' '}
                <strong className="text-foreground/90">Bearer Token</strong> e colar na Vercel como{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">TWITTER_BEARER_TOKEN</code>
                (Production + Preview). Depois <strong className="text-foreground/90">Redeploy</strong>.
              </p>
              {twMsg && (
                <p className="mt-2 text-xs text-sky-200/80 border-l-2 border-sky-500/50 pl-2">{twMsg}</p>
              )}
            </div>
          </div>
          {handles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 w-full sm:w-auto">
                Contas no feed:
              </span>
              {handles.map((h) => (
                <span
                  key={h}
                  className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-200"
                >
                  @{h}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground/80 border-t border-border/30 pt-3">
            <strong className="text-foreground/90">Mais contas:</strong>{' '}
            <code className="rounded bg-muted px-1">TWITTER_EXTRA_USERNAMES=a,b</code> ou lista completa{' '}
            <code className="rounded bg-muted px-1">TWITTER_USERNAMES=...</code>
          </p>
        </div>
      )}

      {!isConfigError && !isError && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
          {FILTROS.map((f) => {
            const count =
              f.value === 'todos' ? feed.length : feed.filter((it) => categoriaDoItem(it) === f.value).length
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
                      filtro === f.value ? 'bg-black/20 text-black' : 'bg-muted/60 text-muted-foreground'
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

      {isConfigError && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6 text-center">
          <p className="font-semibold text-yellow-400">Chave API não configurada</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Adiciona{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">NEWSDATA_API_KEY=tua_chave</code> no
            ficheiro <code className="rounded bg-muted px-1 py-0.5 text-foreground">.env.local</code> (ou na Vercel) e
            reinicia o servidor.
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
          {Array.from({ length: 3 }).map((_, i) => (
            <NewsCardSkeleton key={`n-${i}`} />
          ))}
          {Array.from({ length: 3 }).map((_, i) => (
            <TweetCardSkeleton key={`t-${i}`} />
          ))}
        </div>
      )}

      {!isLoading && !isError && !apiErro && !isConfigError && feedFiltrado.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/40 bg-card/30 py-20 text-center">
          <Newspaper className="h-10 w-10 opacity-20" />
          <div>
            <p className="font-medium">Nenhum item neste filtro</p>
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

      {!isLoading && feedFiltrado.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {feedFiltrado.map((item) =>
            item.tipo === 'noticia' ? (
              <NewsCard key={item.id} n={item.dados} />
            ) : (
              <TweetCard key={item.id} t={item.dados} />
            )
          )}
        </div>
      )}
    </div>
  )
}
