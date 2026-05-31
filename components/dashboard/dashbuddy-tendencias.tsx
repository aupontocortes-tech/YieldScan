'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTendencias } from '@/hooks/use-tendencias'
import {
  DEFAULT_TENDENCIAS_PREFS,
  type AnalysisTone,
  type MomentumPeriod,
  type SentimentLevel,
  type TendenciasAlert,
  type TendenciasPrefs,
  type TendenciasTokenRow,
} from '@/lib/tendencias/types'
import { readTendenciasPrefs, writeTendenciasPrefs } from '@/lib/tendencias/prefs'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { type TrimClass, SCORE_MERCADO_NOME, SCORE_TENDENCIA_FORMULA, SCORE_TENDENCIA_NOME } from '@/lib/tendencias/trim-config'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Layers,
  Newspaper,
  RefreshCw,
  Settings2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

const PERIOD_LABEL: Record<MomentumPeriod, string> = {
  '24h': '24 horas',
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
}

const TRIM_CLASS: Record<TrimClass, string> = {
  fraco: 'text-red-400 bg-red-500/10 border-red-500/30',
  estavel: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  forte: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  acelerando: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
}

const MENTION_SYMBOL_COLOR: Record<string, string> = {
  BTC: 'text-orange-400',
  ETH: 'text-indigo-400',
  XRP: 'text-sky-400',
  ADA: 'text-blue-400',
  SOL: 'text-violet-400',
  BNB: 'text-yellow-400',
  USDT: 'text-emerald-400',
  USDC: 'text-cyan-400',
  DAI: 'text-teal-400',
  LINK: 'text-blue-300',
  NEAR: 'text-lime-400',
  POL: 'text-fuchsia-400',
  MATIC: 'text-fuchsia-400',
  AVAX: 'text-red-400',
  DOGE: 'text-amber-400',
  DOT: 'text-pink-400',
  TRX: 'text-rose-400',
  TON: 'text-sky-300',
  SUI: 'text-cyan-300',
  HYPE: 'text-purple-400',
  AAVE: 'text-indigo-300',
  SHIB: 'text-orange-300',
}

const MENTION_COLOR_FALLBACK = [
  'text-yellow-400',
  'text-cyan-400',
  'text-pink-400',
  'text-lime-400',
  'text-amber-400',
  'text-violet-400',
  'text-rose-400',
  'text-teal-400',
] as const

function mentionSymbolColor(symbol: string): string {
  const key = symbol.toUpperCase()
  if (MENTION_SYMBOL_COLOR[key]) return MENTION_SYMBOL_COLOR[key]
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return MENTION_COLOR_FALLBACK[h % MENTION_COLOR_FALLBACK.length]
}

function headlineMatchesSymbol(
  headline: { titulo: string; symbols?: string[] },
  symbol: string,
): boolean {
  const sym = symbol.toUpperCase()
  if (headline.symbols?.some((s) => s.toUpperCase() === sym)) return true
  return new RegExp(`\\b${sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(headline.titulo)
}

const NEWS_TOP_TOKENS = 10
const NEWS_HEADLINES_DEFAULT = 10
const NEWS_HEADLINES_FILTERED = 15

function NewsTokenFilterBar({
  items,
  activeSymbol,
  onSelectSymbol,
}: {
  items: Array<{ symbol: string; count: number }>
  activeSymbol: string | null
  onSelectSymbol: (symbol: string | null) => void
}) {
  const [custom, setCustom] = useState('')
  const top = items.slice(0, NEWS_TOP_TOKENS)

  function applyCustom() {
    const sym = custom.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!sym) return
    onSelectSymbol(sym)
    setCustom('')
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/40 bg-muted/5 px-2.5 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Filtrar por token</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-pressed={!activeSymbol}
          onClick={() => onSelectSymbol(null)}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
            !activeSymbol
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'text-muted-foreground hover:bg-muted/20',
          )}
        >
          Todas
        </button>
        {top.map((m) => {
          const sym = m.symbol.toUpperCase()
          const active = activeSymbol === sym
          return (
            <button
              key={m.symbol}
              type="button"
              title={`${m.count} menções`}
              aria-pressed={active}
              onClick={() => onSelectSymbol(active ? null : sym)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors',
                active
                  ? 'border-yellow-500/60 bg-yellow-500/15'
                  : 'border-border/40 hover:border-border/70 hover:bg-muted/10',
              )}
            >
              <TokenSymbolAvatar symbol={m.symbol} size={16} />
              <span className={cn('text-xs font-semibold', mentionSymbolColor(m.symbol))}>{m.symbol}</span>
            </button>
          )
        })}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value.toUpperCase())}
          placeholder="Outro token (ex: DOGE)"
          className="h-8 flex-1 text-xs"
          maxLength={12}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyCustom()
          }}
        />
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 px-2.5 text-xs" onClick={applyCustom}>
          Filtrar
        </Button>
      </div>
    </div>
  )
}

type TabId = 'visao' | 'tokens' | 'noticias' | 'defi'

const TABS: { id: TabId; label: string; icon: typeof Sparkles }[] = [
  { id: 'visao', label: 'Visão geral', icon: Sparkles },
  { id: 'tokens', label: 'Tokens', icon: TrendingUp },
  { id: 'noticias', label: 'Notícias', icon: Newspaper },
  { id: 'defi', label: 'DeFi', icon: Layers },
]

type TokenFilter = 'destaques' | 'gainers' | 'losers' | 'volume' | 'trim' | 'mencoes'

const TOKEN_FILTERS: { id: TokenFilter; label: string }[] = [
  { id: 'destaques', label: 'Melhor score' },
  { id: 'gainers', label: 'Em alta' },
  { id: 'losers', label: 'Em queda' },
  { id: 'volume', label: 'Volume' },
  { id: 'trim', label: 'Score alto' },
  { id: 'mencoes', label: 'Mais citados' },
]

function fmtUsd(n: number | null | undefined, compact = false): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (compact) {
    const abs = Math.abs(n)
    const sign = n < 0 ? '-' : ''
    if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)} T US$`
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)} B US$`
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)} M US$`
  }
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

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'gold' | 'up' | 'down'
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate font-mono text-lg font-bold tabular-nums',
          accent === 'gold' && 'text-yellow-500',
          accent === 'up' && 'text-emerald-400',
          accent === 'down' && 'text-red-400',
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

function SentimentGauge({
  score,
  level,
  gainers,
  losers,
}: {
  score: number
  level: SentimentLevel
  gainers?: number
  losers?: number
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <span className={cn('rounded-lg border px-2.5 py-1 text-sm font-semibold', sentimentClass(level))}>
          {sentimentLabel(level)}
        </span>
        <span className="font-mono text-2xl font-bold tabular-nums">
          {score}
          <span className="text-sm font-normal text-muted-foreground">/100</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
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
        <span>0 · pessimista</span>
        <span>50 · neutro</span>
        <span>100 · optimista</span>
      </div>
      {gainers != null && losers != null && (
        <p className="text-[10px] text-muted-foreground">
          {gainers} tokens em alta · {losers} em queda (24h)
        </p>
      )}
    </div>
  )
}

function TokenTableRow({ row, period }: { row: TendenciasTokenRow; period: MomentumPeriod }) {
  const change = row.changePeriod ?? row.change24h
  return (
    <tr className="border-b border-border/30 transition-colors hover:bg-muted/10">
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-2">
          <TokenSymbolAvatar symbol={row.symbol} coingeckoId={row.id} iconUrl={row.image} size={28} />
          <div className="min-w-0">
            <p className="font-semibold leading-none">{row.symbol}</p>
            <p className="truncate text-[10px] text-muted-foreground">{row.name}</p>
          </div>
        </div>
      </td>
      <td className="hidden px-2 py-2.5 text-right font-mono text-xs tabular-nums sm:table-cell">
        {fmtUsd(row.price, true)}
      </td>
      <td className="px-2 py-2.5 text-right">
        <span
          className={cn(
            'font-mono text-xs font-medium tabular-nums',
            (change ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
          )}
        >
          {fmtPct(change)}
        </span>
        <span className="ml-1 text-[9px] text-muted-foreground">{PERIOD_LABEL[period]}</span>
      </td>
      <td className="px-2 py-2.5 text-center">
        <Badge variant="outline" className={cn('font-mono text-[10px]', TRIM_CLASS[row.trimClass])}>
          {row.trimScore}
        </Badge>
      </td>
      <td className="hidden px-2 py-2.5 text-right font-mono text-[10px] tabular-nums text-muted-foreground md:table-cell">
        {fmtUsd(row.volume24h, true)}
      </td>
      <td className="hidden px-2 py-2.5 text-[10px] text-muted-foreground lg:table-cell">
        {row.fmp?.vsMa50 && (
          <span className={row.fmp.vsMa50 === 'above' ? 'text-emerald-400' : 'text-red-400'}>
            50d {row.fmp.vsMa50 === 'above' ? '↑' : '↓'}
          </span>
        )}
        {row.fmp?.vsMa200 && (
          <span className={cn('ml-1.5', row.fmp.vsMa200 === 'above' ? 'text-emerald-400' : 'text-red-400')}>
            200d {row.fmp.vsMa200 === 'above' ? '↑' : '↓'}
          </span>
        )}
        {!row.fmp?.vsMa50 && !row.fmp?.vsMa200 && '—'}
      </td>
    </tr>
  )
}

function AlertRow({ alert }: { alert: TendenciasAlert }) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-xs',
        alert.severity === 'urgent' && 'border-red-500/40 bg-red-950/20',
        alert.severity === 'watch' && 'border-amber-500/30 bg-amber-950/15',
        alert.severity === 'info' && 'border-border/40 bg-muted/10',
      )}
    >
      <p className="font-medium">{alert.title}</p>
      <p className="mt-0.5 text-muted-foreground">{alert.detail}</p>
    </div>
  )
}

function TendenciasSettings({
  prefs,
  onSave,
}: {
  prefs: TendenciasPrefs
  onSave: (p: TendenciasPrefs) => void
}) {
  const [draft, setDraft] = useState(prefs)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) setDraft(prefs)
  }, [open, prefs])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Ajustes
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ajustes da análise</SheetTitle>
          <SheetDescription>Período de momentum e tom dos textos (sem IA externa).</SheetDescription>
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
                <SelectItem value="24h">24 horas</SelectItem>
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
                <SelectItem value="conservador">Conservador</SelectItem>
                <SelectItem value="neutro">Neutro</SelectItem>
                <SelectItem value="agressivo">Agressivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="rounded-lg border border-dashed border-border/50 px-3 py-2 text-[11px] text-muted-foreground">
            {SCORE_TENDENCIA_FORMULA}
          </p>
        </div>
        <SheetFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(draft)
              setOpen(false)
            }}
          >
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
  const [tab, setTab] = useState<TabId>('visao')
  const [tokenFilter, setTokenFilter] = useState<TokenFilter>('destaques')
  const [newsTokenFilter, setNewsTokenFilter] = useState<string | null>(null)

  useEffect(() => {
    setPrefs(readTendenciasPrefs())
    setMounted(true)
  }, [])

  useEffect(() => {
    if (tab !== 'noticias') setNewsTokenFilter(null)
  }, [tab])

  const savePrefs = useCallback((p: TendenciasPrefs) => {
    setPrefs(p)
    writeTendenciasPrefs(p)
  }, [])

  const { data, isLoading, isError, refetch, isFetching } = useTendencias(prefs)
  const period = data?.meta.momentumPeriod ?? prefs.momentumPeriod

  const tokenRows = useMemo(() => {
    if (!data) return []
    const { buckets } = data
    switch (tokenFilter) {
      case 'gainers':
        return buckets.maisPositivos
      case 'losers':
        return buckets.maisNegativos
      case 'volume':
        return buckets.maiorVolume
      case 'trim':
        return buckets.acelerando
      case 'mencoes':
        return buckets.maisComentados
      default:
        return buckets.acelerando.length ? buckets.acelerando : buckets.maiorVolume
    }
  }, [data, tokenFilter])

  const filteredNewsHeadlines = useMemo(() => {
    const headlines = data?.news.headlines ?? []
    if (!newsTokenFilter) return headlines
    return headlines.filter((h) => headlineMatchesSymbol(h, newsTokenFilter))
  }, [data?.news.headlines, newsTokenFilter])

  const displayedNewsHeadlines = useMemo(() => {
    const limit = newsTokenFilter ? NEWS_HEADLINES_FILTERED : NEWS_HEADLINES_DEFAULT
    return filteredNewsHeadlines.slice(0, limit)
  }, [filteredNewsHeadlines, newsTokenFilter])

  if (!mounted || isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
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
  const sourcesLabel = meta.dataSources?.join(' · ') ?? 'coingecko · defillama'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Tendências de mercado</h2>
          <p className="text-xs text-muted-foreground">
            {SCORE_TENDENCIA_NOME} · análise quantitativa · {sourcesLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TendenciasSettings prefs={prefs} onSave={savePrefs} />
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

      {data.partial && data.error && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          {data.error}
        </p>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard
          label="Sentimento"
          value={String(market.sentimentScore)}
          sub={sentimentLabel(market.sentiment)}
          accent={
            market.sentiment === 'optimista' ? 'up' : market.sentiment === 'pessimista' ? 'down' : undefined
          }
        />
        <KpiCard label={SCORE_MERCADO_NOME} value={`${market.trimMarketScore}/100`} accent="gold" />
        <KpiCard
          label="BTC dominance"
          value={market.btcDominance != null ? `${market.btcDominance.toFixed(1)}%` : '—'}
        />
        <KpiCard
          label="Narrativa"
          value={market.dominantNarrative ?? '—'}
          sub={`${market.gainersCount} altas · ${market.losersCount} quedas`}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border/40 bg-muted/20 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              tab === id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Visão geral */}
      {tab === 'visao' && (
        <div className="space-y-4">
          <Card className="border-yellow-500/15 bg-gradient-to-br from-card to-yellow-500/[0.04]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Zap className="h-4 w-4 text-yellow-500" />
                O que observar hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{observeToday}</p>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {PERIOD_LABEL[meta.momentumPeriod]} · Tom {meta.analysisTone}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/50 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Alertas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum alerta relevante.</p>
                ) : (
                  alerts.slice(0, 4).map((a) => <AlertRow key={a.id} alert={a} />)
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sentimento de mercado</CardTitle>
              </CardHeader>
              <CardContent>
                <SentimentGauge
                  score={market.sentimentScore}
                  level={market.sentiment}
                  gainers={market.gainersCount}
                  losers={market.losersCount}
                />
                <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-lg bg-muted/20 px-2 py-1.5">
                    <span className="text-muted-foreground">Cap. total</span>
                    <p className="font-mono font-semibold">{fmtUsd(market.totalMarketCap, true)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/20 px-2 py-1.5">
                    <span className="text-muted-foreground">Volume 24h</span>
                    <p className="font-mono font-semibold">{fmtUsd(market.totalVolume24h, true)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {narratives.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Narrativas activas</p>
              <div className="flex flex-wrap gap-2">
                {narratives.slice(0, 6).map((n) => (
                  <Badge key={n.id} variant="outline" className="gap-1 text-[10px]">
                    {n.label}
                    <span className="text-muted-foreground">· {n.mentionCount}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Tokens */}
      {tab === 'tokens' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {TOKEN_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTokenFilter(f.id)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  tokenFilter === f.id
                    ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-500'
                    : 'border-border/40 text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/50 bg-card/30">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Token</th>
                  <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Preço</th>
                  <th className="px-2 py-2 text-right font-medium">Variação</th>
                  <th className="px-2 py-2 text-center font-medium">Score</th>
                  <th className="hidden px-2 py-2 text-right font-medium md:table-cell">Volume</th>
                  <th className="hidden px-2 py-2 font-medium lg:table-cell">MM FMP</th>
                </tr>
              </thead>
              <tbody>
                {tokenRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      Sem tokens neste filtro.
                    </td>
                  </tr>
                ) : (
                  tokenRows.slice(0, 12).map((r) => <TokenTableRow key={r.id} row={r} period={period} />)
                )}
              </tbody>
            </table>
          </div>

          {buckets.proximosUnlocks.length > 0 && (
            <Card className="border-border/50 bg-card/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Próximos unlocks</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border/30 text-xs">
                  {buckets.proximosUnlocks.map((u) => (
                    <li key={`${u.symbol}-${u.unlockAt}`} className="flex justify-between py-2">
                      <span className="font-medium">{u.symbol}</span>
                      <span className="text-muted-foreground">
                        {u.unlockAt
                          ? new Date(u.unlockAt).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
                          : '—'}
                      </span>
                      <span className="font-mono text-yellow-500">{fmtUsd(u.usdValue, true)}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/unlocks" className="mt-2 inline-block text-[11px] text-yellow-500 hover:underline">
                  Ver calendário →
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Notícias */}
      {tab === 'noticias' && (
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
              <NewsTokenFilterBar
                items={news.topMentions}
                activeSymbol={newsTokenFilter}
                onSelectSymbol={setNewsTokenFilter}
              />
            )}
            <ul className="space-y-3">
              {news.headlines.length === 0 ? (
                <li className="text-lg leading-snug text-muted-foreground">
                  Sem manchetes em português no momento. Clica em Actualizar ou aguarda ~1 minuto.
                </li>
              ) : filteredNewsHeadlines.length === 0 ? (
                <li className="text-sm leading-snug text-muted-foreground">
                  Sem notícias para {newsTokenFilter}. Tenta outro token ou «Todas».
                </li>
              ) : (
                displayedNewsHeadlines.map((h) => (
                  <li
                    key={h.link}
                    className="rounded-lg border border-border/30 bg-muted/5 px-3 py-3"
                  >
                    <a
                      href={h.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-lg font-medium leading-snug text-foreground hover:text-yellow-500 hover:underline"
                    >
                      {h.titulo}
                    </a>
                    <div className="mt-2">
                      <Badge
                        variant="outline"
                        className={cn('text-sm', sentimentClass(h.sentiment))}
                      >
                        {sentimentLabel(h.sentiment)}
                      </Badge>
                    </div>
                  </li>
                ))
              )}
            </ul>
            {filteredNewsHeadlines.length > displayedNewsHeadlines.length && (
              <p className="text-[11px] text-muted-foreground">
                +{filteredNewsHeadlines.length - displayedNewsHeadlines.length} manchetes —{' '}
                <Link href="/news/noticias" className="text-yellow-500 hover:underline">
                  ver todas
                </Link>
              </p>
            )}
            <Link
              href="/news/noticias"
              className="text-sm font-medium text-yellow-500 hover:underline"
            >
              Ver feed completo →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Tab: DeFi */}
      {tab === 'defi' && (
        <Card className="border-border/50 bg-card/40">
          <CardContent className="space-y-4 pt-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{defi.summary}</p>
            <div className="grid grid-cols-2 gap-2">
              <KpiCard label="TVL DeFi" value={fmtUsd(defi.totalTvlUsd, true)} />
              <KpiCard
                label="TVL 7d"
                value={fmtPct(defi.tvlChange7dPct)}
                accent={(defi.tvlChange7dPct ?? 0) >= 0 ? 'up' : 'down'}
              />
            </div>
            {defi.topChains.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {defi.topChains.map((c) => (
                  <Badge key={c.name} variant="outline" className="font-mono text-[10px]">
                    {c.name}: {fmtUsd(c.tvlUsd, true)}
                  </Badge>
                ))}
              </div>
            )}
            {defi.topProtocols.map((p, i) => (
              <div key={i} className="rounded-lg border border-border/30 bg-muted/5 px-3 py-2">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {p.chain}
                    {p.tvlUsd != null ? ` · ${fmtUsd(p.tvlUsd, true)}` : ''}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{p.interpretation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-center text-[10px] text-muted-foreground">
        Actualizado {new Date(data.updatedAt).toLocaleString('pt-PT')}
      </p>
    </div>
  )
}
