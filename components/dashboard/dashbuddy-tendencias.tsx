'use client'

import { useTendencias } from '@/hooks/use-tendencias'
import type { SentimentLevel, TendenciasTokenRow } from '@/lib/tendencias/types'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Brain,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

function fmtUsd(n: number | null | undefined, compact = false): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : n >= 100 ? 0 : 2,
  }).format(n)
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function sentimentLabel(s: SentimentLevel): string {
  if (s === 'optimista') return 'Optimista'
  if (s === 'pessimista') return 'Pessimista'
  return 'Neutro'
}

function sentimentClass(s: SentimentLevel): string {
  if (s === 'optimista') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
  if (s === 'pessimista') return 'text-red-400 border-red-500/30 bg-red-500/10'
  return 'text-amber-300 border-amber-500/30 bg-amber-500/10'
}

function SentimentGauge({ score, level }: { score: number; level: SentimentLevel }) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <span className={cn('rounded-lg border px-2.5 py-1 text-sm font-semibold', sentimentClass(level))}>
          {sentimentLabel(level)}
        </span>
        <span className="font-mono text-2xl font-bold tabular-nums text-foreground">{score}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/40">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            level === 'optimista' && 'bg-emerald-500',
            level === 'pessimista' && 'bg-red-500',
            level === 'neutro' && 'bg-amber-400',
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Pessimista</span>
        <span>Neutro</span>
        <span>Optimista</span>
      </div>
    </div>
  )
}

function TokenMiniRow({ row }: { row: TendenciasTokenRow }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-2.5 py-2">
      <TokenSymbolAvatar symbol={row.symbol} coingeckoId={row.id} iconUrl={row.image} size={28} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.symbol}</p>
        <p className="truncate text-[10px] text-muted-foreground">{row.name}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-xs tabular-nums">{fmtUsd(row.price, true)}</p>
        <p
          className={cn(
            'font-mono text-[10px] tabular-nums',
            (row.change24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
          )}
        >
          {fmtPct(row.change24h)}
        </p>
      </div>
      <Badge variant="outline" className="shrink-0 font-mono text-[10px] tabular-nums">
        {row.aiScore}
      </Badge>
    </div>
  )
}

function TokenBucket({
  title,
  rows,
  empty,
}: {
  title: string
  rows: TendenciasTokenRow[]
  empty?: string
}) {
  if (!rows.length) {
    return (
      <Card className="border-border/50 bg-card/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">{empty ?? 'Sem dados.'}</CardContent>
      </Card>
    )
  }
  return (
    <Card className="border-border/50 bg-card/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rows.slice(0, 6).map((r) => (
          <TokenMiniRow key={r.id} row={r} />
        ))}
      </CardContent>
    </Card>
  )
}

export function DashbuddyTendencias() {
  const { data, isLoading, isError, refetch, isFetching } = useTendencias()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-8 text-center">
        <p className="text-sm text-red-200">Não foi possível carregar Tendências.</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Tentar de novo
        </Button>
      </div>
    )
  }

  const { market, observeToday, news, narratives, buckets, alerts } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold">Terminal de inteligência</h2>
            <p className="text-xs text-muted-foreground">
              Análise automática — CoinGecko, notícias e unlocks
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      {data.partial && data.error && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          {data.error}
        </p>
      )}

      {/* Painel mercado */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-yellow-500/20 bg-gradient-to-br from-card via-card to-yellow-500/[0.06] lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Brain className="h-4 w-4 text-yellow-500" />
              Sentimento do mercado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SentimentGauge score={market.sentimentScore} level={market.sentiment} />
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/40 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Painel inteligente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="BTC dominance" value={market.btcDominance != null ? `${market.btcDominance.toFixed(1)}%` : '—'} />
              <Metric label="Volume 24h" value={fmtUsd(market.totalVolume24h, true)} />
              <Metric label="Cap. total" value={fmtUsd(market.totalMarketCap, true)} />
              <Metric
                label="Cap. 24h"
                value={fmtPct(market.marketCapChange24h)}
                accent={(market.marketCapChange24h ?? 0) >= 0 ? 'up' : 'down'}
              />
              <Metric label="Índice tendência" value={`${market.trendIndex}/100`} accent="gold" />
              <Metric label="Em alta" value={String(market.gainersCount)} accent="up" />
              <Metric label="Em queda" value={String(market.losersCount)} accent="down" />
              <Metric label="Narrativa" value={market.dominantNarrative ?? '—'} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* O que observar hoje */}
      <Card className="border-border/50 bg-card/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="h-4 w-4 text-yellow-500" />
            O que observar hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">{observeToday}</p>
        </CardContent>
      </Card>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Alertas inteligentes
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {alerts.map((a) => (
              <div
                key={a.id}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-sm',
                  a.severity === 'urgent' && 'border-red-500/40 bg-red-950/20',
                  a.severity === 'watch' && 'border-amber-500/30 bg-amber-950/15',
                  a.severity === 'info' && 'border-border/50 bg-muted/10',
                )}
              >
                <p className="font-medium">{a.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tokens em destaque */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Tokens em destaque</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TokenBucket title="Mais comentados" rows={buckets.maisComentados} />
          <TokenBucket title="Mais positivos (24h)" rows={buckets.maisPositivos} />
          <TokenBucket title="Mais negativos (24h)" rows={buckets.maisNegativos} />
          <TokenBucket title="Maior volume" rows={buckets.maiorVolume} />
          <TokenBucket title="Tendência acelerando" rows={buckets.acelerando} />
          <TokenBucket title="Tendência a enfraquecer" rows={buckets.desacelerando} />
        </div>
      </div>

      {/* Momentum explicações */}
      {buckets.acelerando.length > 0 && (
        <Card className="border-border/50 bg-card/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Momentum — leitura IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {buckets.acelerando.slice(0, 4).map((r) => (
              <p key={r.id} className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">{r.symbol}</span> — {r.momentumReason}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notícias + narrativas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Notícias analisadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge className="bg-emerald-500/15 text-emerald-400">
                <TrendingUp className="mr-1 h-3 w-3" />
                {news.positivo} positivas
              </Badge>
              <Badge variant="outline">{news.neutro} neutras</Badge>
              <Badge className="bg-red-500/15 text-red-400">
                <TrendingDown className="mr-1 h-3 w-3" />
                {news.negativo} negativas
              </Badge>
            </div>
            {news.topMentions.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Mais mencionados:{' '}
                {news.topMentions.map((m) => `${m.symbol} (${m.count})`).join(' · ')}
              </p>
            )}
            <ul className="space-y-2 border-t border-border/40 pt-2">
              {news.headlines.map((h, i) => (
                <li key={i}>
                  <a
                    href={h.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs leading-snug text-foreground hover:text-yellow-500 hover:underline"
                  >
                    {h.titulo}
                  </a>
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    · {h.impacto} · {h.categoria}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/news/noticias" className="text-xs font-medium text-yellow-500 hover:underline">
              Ver todas as notícias →
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Narrativas dominantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {narratives.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem narrativas detectadas no feed recente.</p>
            ) : (
              narratives.map((n) => (
                <div key={n.id} className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{n.label}</p>
                    <Badge variant="outline" className={cn('text-[10px]', sentimentClass(n.sentiment))}>
                      {sentimentLabel(n.sentiment)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{n.summary}</p>
                  {n.relatedSymbols.length > 0 && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Relacionados: {n.relatedSymbols.join(', ')}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unlocks */}
      {buckets.proximosUnlocks.length > 0 && (
        <Card className="border-border/50 bg-card/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Próximos unlocks relevantes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/40">
              {buckets.proximosUnlocks.map((u) => (
                <li key={`${u.symbol}-${u.unlockAt}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium">{u.symbol}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {u.unlockAt
                      ? new Date(u.unlockAt).toLocaleDateString('pt-PT', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : '—'}
                  </span>
                  <span className="font-mono text-xs text-yellow-500">{fmtUsd(u.usdValue, true)}</span>
                </li>
              ))}
            </ul>
            <Link href="/unlocks" className="mt-2 inline-block text-xs font-medium text-yellow-500 hover:underline">
              Ver calendário completo →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'up' | 'down' | 'gold'
}) {
  return (
    <div className="rounded-lg bg-muted/15 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate font-mono text-sm font-semibold tabular-nums',
          accent === 'up' && 'text-emerald-400',
          accent === 'down' && 'text-red-400',
          accent === 'gold' && 'text-yellow-500',
        )}
      >
        {value}
      </p>
    </div>
  )
}
