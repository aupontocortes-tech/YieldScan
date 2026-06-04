'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Newspaper } from 'lucide-react'
import { fetchNoticiasClient } from '@/lib/fetch-noticias-client'
import { noticiasParaFeed, type ItemFeedNoticia } from '@/lib/market-feed'
import { NEWS_CLIENT_STALE_MS } from '@/lib/news-refresh-config'
import { fallbackImagemPorCategoria } from '@/lib/news-image-fallback'
import { resolveNewsCardImageSrc } from '@/lib/news-image-src'
import type { InsightNoticia, NoticiaProcessada } from '@/lib/newsdata'
import { HubPanel } from '@/components/dashboard/hub/hub-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const LIMIT = 4

const IMPACT_DOT: Record<InsightNoticia['impacto'], string> = {
  POSITIVO: 'bg-emerald-500',
  NEGATIVO: 'bg-red-500',
  NEUTRO: 'bg-zinc-500',
}

const CAT_PILL: Record<string, string> = {
  CRIPTO: 'text-orange-300',
  ACOES: 'text-blue-300',
  GEOPOLÍTICA: 'text-red-300',
  MACRO: 'text-amber-300',
  IA: 'text-violet-300',
}

export function HubNews() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashbuddy-news', 'hub-panel'],
    queryFn: () => fetchNoticiasClient(),
    staleTime: NEWS_CLIENT_STALE_MS,
  })

  const items: ItemFeedNoticia[] = (() => {
    if (!data) return []
    if (data.feed?.length) return (data.feed as ItemFeedNoticia[]).slice(0, LIMIT)
    const raw = (data.noticias ?? []) as NoticiaProcessada[]
    return noticiasParaFeed(raw).slice(0, LIMIT)
  })()

  return (
    <HubPanel
      title="Notícias"
      subtitle="Manchetes recentes do feed"
      icon={Newspaper}
      accent="blue"
      href="/news/noticias"
      linkLabel="Ver feed"
      bodyClassName="flex flex-1 flex-col gap-0 !px-0 !py-0"
      noPadding
    >
      <div className="flex flex-1 flex-col">
        {isLoading && (
          <ul className="space-y-0 divide-y divide-white/[0.06] px-4 sm:px-5">
            {Array.from({ length: LIMIT }).map((_, i) => (
              <li key={i} className="flex gap-3 py-3">
                <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {!isLoading && (isError || items.length === 0) && (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground sm:px-5">
            {isError ? 'Erro ao carregar notícias.' : 'Sem manchetes.'}
          </p>
        )}

        {!isLoading && items.length > 0 && (
          <ul className="divide-y divide-white/[0.06]">
            {items.map((item) => {
              const n = item.dados
              const titulo = n.titulo?.trim() || 'Sem título'
              const href = n.link?.trim()
              const img = resolveNewsCardImageSrc(
                n.imagemUrl || fallbackImagemPorCategoria(n.categoria),
              )
              const row = (
                <>
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-muted/20 ring-1 ring-white/[0.04]">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                        {n.categoria.slice(0, 3)}
                      </div>
                    )}
                    <span
                      className={cn(
                        'absolute bottom-1 right-1 h-2 w-2 rounded-full ring-2 ring-background',
                        IMPACT_DOT[n.impacto],
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                      {titulo}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'text-[10px] font-semibold uppercase tracking-wide',
                          CAT_PILL[n.categoria] ?? 'text-muted-foreground',
                        )}
                      >
                        {n.categoria}
                      </span>
                      {n.fonte && (
                        <span className="truncate text-[10px] text-muted-foreground">{n.fonte}</span>
                      )}
                    </div>
                  </div>
                </>
              )
              return (
                <li key={item.id}>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex gap-3 px-4 py-3 transition-colors hover:bg-blue-500/[0.04] sm:px-5"
                    >
                      {row}
                    </a>
                  ) : (
                    <div className="flex gap-3 px-4 py-3 sm:px-5">{row}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-white/[0.06] p-3 sm:p-4">
          <Link
            href="/news/mercado"
            className="rounded-xl border border-border/50 py-2 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
          >
            Mercado
          </Link>
          <Link
            href="/news/tendencias"
            className="rounded-xl border border-yellow-500/25 bg-yellow-500/5 py-2 text-center text-[11px] font-medium text-yellow-400/90 transition-colors hover:bg-yellow-500/10"
          >
            Tendências
          </Link>
        </div>
      </div>
    </HubPanel>
  )
}
