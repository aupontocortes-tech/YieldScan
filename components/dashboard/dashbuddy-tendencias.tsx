'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTendencias } from '@/hooks/use-tendencias'
import {
  DEFAULT_TENDENCIAS_PREFS,
  type AnalysisTone,
  type MomentumClass,
  type MomentumPeriod,
  type SentimentLevel,
  type TendenciasPrefs,
  type TendenciasTokenRow,
} from '@/lib/tendencias/types'
import { readTendenciasPrefs, writeTendenciasPrefs } from '@/lib/tendencias/prefs'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Brain,
  Layers,
  RefreshCw,
  Settings2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

const PERIOD_LABEL: Record<MomentumPeriod, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
}

const MOMENTUM_CLASS: Record<MomentumClass, string> = {
  acelerando: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  estavel: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  fraco: 'text-red-400 bg-red-500/10 border-red-500/30',
  reversao: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
}

const SECTIONS = [
  { id: 'mercado', label: 'Mercado' },
  { id: 'resumo', label: 'Resumo' },
  { id: 'alertas', label: 'Alertas' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'momentum', label: 'Momentum' },
  { id: 'noticias', label: 'Notícias' },
  { id: 'narrativas', label: 'Narrativas' },
  { id: 'defi', label: 'DeFi' },
] as const

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

function TokenFullRow({ row, period }: { row: TendenciasTokenRow; period: MomentumPeriod }) {
  const change = row.changePeriod ?? row.change24h
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <TokenSymbolAvatar symbol={row.symbol} coingeckoId={row.id} iconUrl={row.image} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">{row.symbol}</span>
            <Badge variant="outline" className={cn('text-[10px]', sentimentClass(row.sentiment))}>
              {sentimentLabel(row.sentiment)}
            </Badge>
            <Badge variant="outline" className={cn('text-[10px]', MOMENTUM_CLASS[row.momentum])}>
              {row.momentumLabel}
            </Badge>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{row.name}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm tabular-nums">{fmtUsd(row.price, true)}</p>
          <p
            className={cn(
              'font-mono text-xs tabular-nums font-medium',
              (change ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {fmtPct(change)} <span className="text-[10px] text-muted-foreground">({period})</span>
          </p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] sm:grid-cols-4">
        <Stat label="Volume 24h" value={fmtUsd(row.volume24h, true)} />
        <Stat label="Market cap" value={fmtUsd(row.marketCap, true)} />
        <Stat label="Score IA" value={String(row.aiScore)} accent="gold" />
        <Stat label="Força" value={`${row.strength}/100`} />
      </div>
      {row.momentumReason && (
        <p className="mt-2 border-t border-border/30 pt-2 text-[11px] leading-relaxed text-muted-foreground">
          {row.momentumReason}
        </p>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'gold'
}) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={cn('font-mono font-medium tabular-nums', accent === 'gold' && 'text-yellow-500')}>
        {value}
      </p>
    </div>
  )
}

function TokenBucket({
  title,
  rows,
  period,
  empty,
}: {
  title: string
  rows: TendenciasTokenRow[]
  period: MomentumPeriod
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
      <CardContent className="space-y-2">
        {rows.slice(0, 5).map((r) => (
          <TokenFullRow key={r.id} row={r} period={period} />
        ))}
      </CardContent>
    </Card>
  )
}

function TendenciasSettings({
  prefs,
  onSave,
  llmEnabled,
  fmpConfigured,
}: {
  prefs: TendenciasPrefs
  onSave: (p: TendenciasPrefs) => void
  llmEnabled: boolean
  fmpConfigured: boolean
}) {
  const [draft, setDraft] = useState(prefs)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) setDraft(prefs)
  }, [open, prefs])

  const apply = () => {
    onSave(draft)
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Ajustes IA
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ajustes da análise</SheetTitle>
          <SheetDescription>
            Personalize o período de momentum, tom da escrita e instruções extras para a IA.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 py-2">
          <div className="space-y-2">
            <Label>Período de momentum</Label>
            <Select
              value={draft.momentumPeriod}
              onValueChange={(v) => setDraft((d) => ({ ...d, momentumPeriod: v as MomentumPeriod }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="90d">90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tom da análise</Label>
            <Select
              value={draft.analysisTone}
              onValueChange={(v) => setDraft((d) => ({ ...d, analysisTone: v as AnalysisTone }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conservador">Conservador — foco em riscos</SelectItem>
                <SelectItem value="neutro">Neutro — equilibrado</SelectItem>
                <SelectItem value="agressivo">Agressivo — oportunidades</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-note">Nota personalizada (prompt)</Label>
            <Textarea
              id="custom-note"
              placeholder="Ex.: focar em Layer 2 e ETFs; ignorar memecoins…"
              value={draft.customPromptNote}
              onChange={(e) => setDraft((d) => ({ ...d, customPromptNote: e.target.value }))}
              rows={4}
              className="resize-none text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Enviada à IA no resumo &quot;O que observar hoje&quot; quando OPENAI_API_KEY estiver configurada.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5">
            <div>
              <Label htmlFor="use-llm" className="text-sm">
                Enriquecer com IA (OpenAI)
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {llmEnabled ? 'Chave detectada no servidor.' : 'Sem OPENAI_API_KEY — usa heurísticas locais.'}
              </p>
            </div>
            <Switch
              id="use-llm"
              checked={draft.useLlm}
              disabled={!llmEnabled}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, useLlm: v }))}
            />
          </div>
          <div className="rounded-lg border border-dashed border-border/50 px-3 py-2 text-[11px] text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">FMP (Financial Modeling Prep):</span>{' '}
              {fmpConfigured ? 'chave configurada — integração futura para MAs e year high/low.' : 'não configurada (FMP_API_KEY).'}
            </p>
          </div>
        </div>
        <SheetFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={apply}>
            Aplicar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function DashbuddyTendencias() {
  const [prefs, setPrefs] = useState<TendenciasPrefs>(DEFAULT_TENDENCIAS_PREFS)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setPrefs(readTendenciasPrefs())
    setMounted(true)
  }, [])

  const savePrefs = useCallback((p: TendenciasPrefs) => {
    setPrefs(p)
    writeTendenciasPrefs(p)
  }, [])

  const { data, isLoading, isError, refetch, isFetching } = useTendencias(prefs)

  const period = data?.meta.momentumPeriod ?? prefs.momentumPeriod

  const momentumRows = useMemo(() => {
    if (!data) return []
    const seen = new Set<string>()
    const out: TendenciasTokenRow[] = []
    for (const r of [...data.buckets.acelerando, ...data.buckets.desacelerando]) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      out.push(r)
    }
    return out.slice(0, 6)
  }, [data])

  if (!mounted || isLoading) {
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

  const { market, observeToday, news, narratives, buckets, alerts, defi, meta } = data

  return (
    <div className="space-y-5">
      {/* Header terminal */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold">Terminal de inteligência</h2>
            <p className="text-xs text-muted-foreground">
              CoinGecko · Notícias · DefiLlama · análise automática
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px]">
            Momentum: {PERIOD_LABEL[period]}
          </Badge>
          {meta.llmUsed && (
            <Badge className="bg-violet-500/15 text-violet-300 text-[10px]">IA activa</Badge>
          )}
          {meta.llmEnabled && !meta.llmUsed && prefs.useLlm && (
            <Badge variant="outline" className="text-[10px]">
              IA disponível
            </Badge>
          )}
          <TendenciasSettings
            prefs={prefs}
            onSave={savePrefs}
            llmEnabled={meta.llmEnabled}
            fmpConfigured={meta.fmpConfigured}
          />
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
      </div>

      {/* Nav secções */}
      <nav className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-border/40 bg-background/90 p-1 backdrop-blur-sm">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {data.partial && data.error && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          {data.error}
        </p>
      )}

      {/* 1. Painel mercado */}
      <section id="mercado" className="scroll-mt-20 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          1 · Painel inteligente do mercado
        </h3>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-yellow-500/20 bg-gradient-to-br from-card via-card to-yellow-500/[0.06] lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Brain className="h-4 w-4 text-yellow-500" />
                Sentimento geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SentimentGauge score={market.sentimentScore} level={market.sentiment} />
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/40 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Indicadores de mercado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="BTC dominance" value={market.btcDominance != null ? `${market.btcDominance.toFixed(1)}%` : '—'} />
                <Metric label="Volume total 24h" value={fmtUsd(market.totalVolume24h, true)} />
                <Metric label="Cap. total" value={fmtUsd(market.totalMarketCap, true)} />
                <Metric
                  label="Cap. 24h"
                  value={fmtPct(market.marketCapChange24h)}
                  accent={(market.marketCapChange24h ?? 0) >= 0 ? 'up' : 'down'}
                />
                <Metric label="Índice tendência" value={`${market.trendIndex}/100`} accent="gold" />
                <Metric label="Ativos em alta" value={String(market.gainersCount)} accent="up" />
                <Metric label="Ativos em queda" value={String(market.losersCount)} accent="down" />
                <Metric label="Narrativa dominante" value={market.dominantNarrative ?? '—'} />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 2. Resumo */}
      <section id="resumo" className="scroll-mt-20 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          2 · O que observar hoje
        </h3>
        <Card className="border-yellow-500/15 bg-gradient-to-r from-card to-yellow-500/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4 text-yellow-500" />
              Resumo automático por IA
              {meta.llmUsed && (
                <Badge variant="outline" className="ml-1 text-[10px] text-violet-300">
                  OpenAI
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground/90">{observeToday}</p>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Tom: {meta.analysisTone} · Período momentum: {PERIOD_LABEL[meta.momentumPeriod]}
              {prefs.customPromptNote.trim() ? ' · Nota personalizada aplicada' : ''}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 3. Alertas */}
      <section id="alertas" className="scroll-mt-20 space-y-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" />
          3 · Alertas inteligentes
        </h3>
        {alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum alerta relevante no momento.</p>
        ) : (
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
                <div className="flex items-center gap-2">
                  <p className="font-medium">{a.title}</p>
                  <Badge variant="outline" className="text-[9px] uppercase">
                    {a.type}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Tokens */}
      <section id="tokens" className="scroll-mt-20 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          4 · Tokens em destaque
        </h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <TokenBucket title="Mais comentados" rows={buckets.maisComentados} period={period} />
          <TokenBucket title={`Mais positivos (${period})`} rows={buckets.maisPositivos} period={period} />
          <TokenBucket title={`Mais negativos (${period})`} rows={buckets.maisNegativos} period={period} />
          <TokenBucket title="Maior volume" rows={buckets.maiorVolume} period={period} />
          <TokenBucket title="Tendência acelerando" rows={buckets.acelerando} period={period} />
          <TokenBucket title="Tendência a desacelerar" rows={buckets.desacelerando} period={period} />
        </div>
      </section>

      {/* 5. Momentum */}
      <section id="momentum" className="scroll-mt-20 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          5 · Momentum inteligente ({PERIOD_LABEL[period]})
        </h3>
        <Card className="border-border/50 bg-card/30">
          <CardContent className="space-y-2 pt-4">
            {momentumRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem leituras de momentum disponíveis.</p>
            ) : (
              momentumRows.map((r) => (
                <div key={r.id} className="rounded-lg border border-border/30 bg-muted/5 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.symbol}</span>
                    <Badge variant="outline" className={cn('text-[10px]', MOMENTUM_CLASS[r.momentum])}>
                      {r.momentumLabel}
                    </Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Score {r.aiScore} · Força {r.strength}/100
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.momentumReason}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* 6. Notícias */}
      <section id="noticias" className="scroll-mt-20 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          6 · Análise de notícias com IA
        </h3>
        <Card className="border-border/50 bg-card/40">
          <CardContent className="space-y-3 pt-4">
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
                Tokens mais mencionados:{' '}
                {news.topMentions.map((m) => `${m.symbol} (${m.count})`).join(' · ')}
              </p>
            )}
            {news.dominantNarrative && (
              <p className="text-xs">
                Narrativa dominante: <span className="font-medium text-yellow-500">{news.dominantNarrative}</span>
              </p>
            )}
            <ul className="space-y-2 border-t border-border/40 pt-2">
              {news.headlines.map((h, i) => (
                <li key={i} className="rounded-lg border border-border/30 bg-muted/5 px-2.5 py-2">
                  <a
                    href={h.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs leading-snug text-foreground hover:text-yellow-500 hover:underline"
                  >
                    {h.titulo}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={cn('text-[9px]', sentimentClass(h.sentiment))}>
                      {sentimentLabel(h.sentiment)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      Relevância {h.relevance}/100 · Intensidade {h.intensity}/100
                      {h.mentionCount > 0 ? ` · ${h.mentionCount} menções` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/news/noticias" className="text-xs font-medium text-yellow-500 hover:underline">
              Ver todas as notícias →
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* 7. Narrativas */}
      <section id="narrativas" className="scroll-mt-20 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          7 · Narrativas dominantes
        </h3>
        {narratives.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem narrativas detectadas no feed recente.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {narratives.map((n) => (
              <Card key={n.id} className="border-border/50 bg-card/30">
                <CardContent className="space-y-2 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{n.label}</p>
                    <div className="flex gap-1">
                      <Badge variant="outline" className={cn('text-[10px]', sentimentClass(n.sentiment))}>
                        {sentimentLabel(n.sentiment)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        Impacto {n.impact}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{n.summary}</p>
                  <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    <span>{n.mentionCount} menções</span>
                    <span>·</span>
                    <span>Intensidade {n.intensity}/100</span>
                  </div>
                  {n.relatedSymbols.length > 0 && (
                    <p className="text-[10px] text-yellow-500/80">
                      Ativos: {n.relatedSymbols.join(', ')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 8. DeFi + Unlocks */}
      <section id="defi" className="scroll-mt-20 space-y-4">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          8 · Fundamentos DeFi
        </h3>
        <Card className="border-border/50 bg-card/40">
          <CardContent className="space-y-4 pt-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{defi.summary}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="TVL total DeFi" value={fmtUsd(defi.totalTvlUsd, true)} />
              <Metric
                label="Variação TVL 7d"
                value={fmtPct(defi.tvlChange7dPct)}
                accent={(defi.tvlChange7dPct ?? 0) >= 0 ? 'up' : 'down'}
              />
            </div>
            {defi.topChains.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium">Top chains por TVL</p>
                <div className="flex flex-wrap gap-2">
                  {defi.topChains.map((c) => (
                    <Badge key={c.name} variant="outline" className="font-mono text-[10px]">
                      {c.name}: {fmtUsd(c.tvlUsd, true)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {defi.topProtocols.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Protocolos em destaque</p>
                {defi.topProtocols.map((p, i) => (
                  <div key={i} className="rounded-lg border border-border/30 bg-muted/5 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {p.chain}
                        {p.tvlUsd != null ? ` · TVL ${fmtUsd(p.tvlUsd, true)}` : ''}
                        {p.apy != null ? ` · APY ${p.apy.toFixed(1)}%` : ''}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{p.interpretation}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {buckets.proximosUnlocks.length > 0 && (
          <Card className="border-border/50 bg-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Próximos unlocks importantes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border/40">
                {buckets.proximosUnlocks.map((u) => (
                  <li
                    key={`${u.symbol}-${u.unlockAt}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span className="font-medium">{u.symbol}</span>
                    <span className="text-xs text-muted-foreground">{u.name}</span>
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
      </section>

      <p className="text-center text-[10px] text-muted-foreground">
        Actualizado {new Date(data.updatedAt).toLocaleString('pt-PT')}
      </p>
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
