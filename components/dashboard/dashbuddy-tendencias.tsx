'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useTendencias } from '@/hooks/use-tendencias'
import {
  DEFAULT_TENDENCIAS_PREFS,
  type AnalysisTone,
  type MomentumPeriod,
  type SentimentLevel,
  type TendenciasAlert,
  type TendenciasEquityRow,
  type TendenciasNewsHeadline,
  type TendenciasNewsMention,
  type TendenciasPrefs,
  type TendenciasTokenRow,
} from '@/lib/tendencias/types'
import { readTendenciasPrefs, writeTendenciasPrefs } from '@/lib/tendencias/prefs'
import { NEWS_MENTIONS_RANKING_HINT } from '@/lib/tendencias/rank-news-mentions'
import { TICKER_TO_XSTOCK } from '@/lib/us-equities'
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
  getGfSpeechActiveId,
  getGfSpeechActiveIdServer,
  isGfSpeechSupported,
  primeGfSpeechVoices,
  subscribeGfSpeech,
  toggleGfSpeech,
} from '@/lib/speech/gf-speech'
import {
  AlertTriangle,
  Building2,
  Layers,
  Newspaper,
  RefreshCw,
  Settings2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Volume2,
  X,
  Zap,
} from 'lucide-react'

type NewsMentionFilter = { kind: 'crypto' | 'stock'; symbol: string }

function headlineMatchesMention(h: TendenciasNewsHeadline, filter: NewsMentionFilter): boolean {
  const sym = filter.symbol.toUpperCase()
  if (filter.kind === 'crypto') {
    return h.symbols.some((s) => s.toUpperCase() === sym)
  }
  return (h.stockSymbols ?? []).some((s) => s.toUpperCase() === sym)
}
import Link from 'next/link'
import { DefiTendenciasPanel } from '@/components/dashboard/defi-tendencias-panel'

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

const NEWS_HEADLINES_DEFAULT = 10

function fmtMentionChange(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return ''
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function NewsMentionRow({
  item,
  kind,
  rank,
  selected,
  onSelect,
}: {
  item: TendenciasNewsMention
  kind: 'crypto' | 'stock'
  rank: number
  selected: boolean
  onSelect: () => void
}) {
  const sym = item.symbol.toUpperCase()
  const xstockId = kind === 'stock' ? TICKER_TO_XSTOCK[sym] : undefined
  const ch = fmtMentionChange(item.changePct)
  const changeUp = item.changePct != null && item.changePct > 0
  const changeDown = item.changePct != null && item.changePct < 0
  return (
    <button
      type="button"
      title={`${item.count} menção${item.count === 1 ? '' : 'ões'}${ch ? ` · preço ${ch} no período` : ''}`}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
        selected
          ? 'border-yellow-500/50 bg-yellow-500/10 ring-1 ring-yellow-500/30'
          : 'border-border/40 bg-background/40 hover:border-border/60 hover:bg-muted/20',
      )}
    >
      <span className="w-5 shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">
        {rank}
      </span>
      <TokenSymbolAvatar symbol={sym} coingeckoId={xstockId} size={22} />
      <span className={cn('min-w-0 flex-1 truncate text-sm font-semibold', mentionSymbolColor(sym))}>
        {sym}
      </span>
      <span className="shrink-0 rounded-full bg-muted/30 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
        {item.count}
      </span>
      {ch ? (
        <span
          className={cn(
            'shrink-0 text-[10px] font-medium tabular-nums',
            changeUp && 'text-emerald-400',
            changeDown && 'text-red-400',
            !changeUp && !changeDown && 'text-muted-foreground',
          )}
        >
          {ch}
        </span>
      ) : (
        <span className="shrink-0 text-[10px] text-muted-foreground">—</span>
      )}
    </button>
  )
}

function NewsMentionExpand({
  total,
  visible,
  onExpand,
}: {
  total: number
  visible: number
  onExpand: (next: 10 | 15 | 20) => void
}) {
  if (total <= 10) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {visible < 15 && total > 10 ? (
        <button
          type="button"
          onClick={() => onExpand(15)}
          className="text-[10px] font-medium text-yellow-500 hover:underline"
        >
          Ver até 15
        </button>
      ) : null}
      {visible < 20 && total > 15 ? (
        <button
          type="button"
          onClick={() => onExpand(20)}
          className="text-[10px] font-medium text-yellow-500 hover:underline"
        >
          Ver até 20
        </button>
      ) : null}
      {visible > 10 ? (
        <button
          type="button"
          onClick={() => onExpand(10)}
          className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
        >
          Só top 10
        </button>
      ) : null}
    </div>
  )
}

function NewsTopMentionsSection({
  topCrypto,
  topStocks,
  period,
  mentionFilter,
  onMentionFilter,
}: {
  topCrypto: TendenciasNewsMention[]
  topStocks: TendenciasNewsMention[]
  period: MomentumPeriod
  mentionFilter: NewsMentionFilter | null
  onMentionFilter: (next: NewsMentionFilter | null) => void
}) {
  const [cryptoLimit, setCryptoLimit] = useState<10 | 15 | 20>(10)
  const [stockLimit, setStockLimit] = useState<10 | 15 | 20>(10)

  const cryptoVisible = topCrypto.slice(0, cryptoLimit)
  const stockVisible = topStocks.slice(0, stockLimit)

  const toggleFilter = (kind: 'crypto' | 'stock', symbol: string) => {
    const sym = symbol.toUpperCase()
    if (mentionFilter?.kind === kind && mentionFilter.symbol === sym) {
      onMentionFilter(null)
    } else {
      onMentionFilter({ kind, symbol: sym })
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {NEWS_MENTIONS_RANKING_HINT} Período do preço:{' '}
        <span className="text-foreground">{PERIOD_LABEL[period]}</span>.
      </p>

      {mentionFilter ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
          <span className="text-xs text-foreground">
            A mostrar notícias de{' '}
            <span className="font-semibold text-yellow-500">{mentionFilter.symbol}</span>
            {mentionFilter.kind === 'stock' ? ' (ação)' : ' (cripto)'}
          </span>
          <button
            type="button"
            onClick={() => onMentionFilter(null)}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border/50 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground"
          >
            <X className="h-3 w-3" aria-hidden />
            Limpar filtro
          </button>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">Clica num ativo para filtrar as manchetes abaixo.</p>
      )}

      <section className="rounded-lg border border-border/40 bg-muted/5 px-3 py-2.5">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Top {cryptoLimit} cripto — mais falados
        </p>
        {cryptoVisible.length > 0 ? (
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {cryptoVisible.map((m, i) => (
              <li key={`c-${m.symbol}`}>
                <NewsMentionRow
                  item={m}
                  kind="crypto"
                  rank={i + 1}
                  selected={mentionFilter?.kind === 'crypto' && mentionFilter.symbol === m.symbol.toUpperCase()}
                  onSelect={() => toggleFilter('crypto', m.symbol)}
                />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground">Sem menções a tokens nas manchetes PT agora.</p>
        )}
        <NewsMentionExpand total={topCrypto.length} visible={cryptoLimit} onExpand={setCryptoLimit} />
      </section>

      <section className="rounded-lg border border-border/40 bg-muted/5 px-3 py-2.5">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Top {stockLimit} ações US — mais faladas
        </p>
        {stockVisible.length > 0 ? (
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {stockVisible.map((m, i) => (
              <li key={`s-${m.symbol}`}>
                <NewsMentionRow
                  item={m}
                  kind="stock"
                  rank={i + 1}
                  selected={mentionFilter?.kind === 'stock' && mentionFilter.symbol === m.symbol.toUpperCase()}
                  onSelect={() => toggleFilter('stock', m.symbol)}
                />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground">Sem menções a ações nas manchetes PT agora.</p>
        )}
        <NewsMentionExpand total={topStocks.length} visible={stockLimit} onExpand={setStockLimit} />
      </section>
    </div>
  )
}

type TabId = 'visao' | 'tokens' | 'acoes' | 'noticias' | 'defi'

const TABS: { id: TabId; label: string; icon: typeof Sparkles }[] = [
  { id: 'visao', label: 'Visão geral', icon: Sparkles },
  { id: 'tokens', label: 'Tokens', icon: TrendingUp },
  { id: 'acoes', label: 'Ações US', icon: Building2 },
  { id: 'noticias', label: 'Notícias', icon: Newspaper },
  { id: 'defi', label: 'DeFi', icon: Layers },
]

const EQUITY_SECTOR_LABEL: Record<TendenciasEquityRow['sectorTag'], string> = {
  indice: 'Índice',
  ia: 'IA',
  semis: 'Semicondutores',
  'big-tech': 'Big Tech',
  outro: 'Ações',
}

const EQUITY_SECTOR_CLASS: Record<TendenciasEquityRow['sectorTag'], string> = {
  indice: 'border-slate-500/35 bg-slate-500/10 text-slate-300',
  ia: 'border-violet-500/35 bg-violet-500/10 text-violet-300',
  semis: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-300',
  'big-tech': 'border-blue-500/35 bg-blue-500/10 text-blue-300',
  outro: 'border-border/40 bg-muted/10 text-muted-foreground',
}

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

const ANALYSIS_HIGHLIGHT_RE =
  /(\d{1,3}\/100|[-+]?\d+[.,]?\d*\s*%|~?[\d.,]+\s*(?:[BMT])?\s*(?:USD|US\$)?|\b(?:SOL|BTC|ETH|XRP|BNB|ADA|DOGE|AVAX|LINK|DeFi|TVL)\b)/gi

function isAnalysisHighlight(part: string): boolean {
  if (!part.trim()) return false
  return (
    /^\d{1,3}\/100$/i.test(part) ||
    /^[-+]?\d+[.,]?\d*\s*%$/.test(part) ||
    /^~?[\d.,]+\s*(?:[BMT])?\s*(?:USD|US\$)?$/i.test(part) ||
    /^(?:SOL|BTC|ETH|XRP|BNB|ADA|DOGE|AVAX|LINK|DeFi|TVL)$/i.test(part)
  )
}

function highlightClass(part: string): string {
  if (/^\d{1,3}\/100$/i.test(part)) return 'text-yellow-300'
  if (/^\+/.test(part) && /%/.test(part)) return 'text-emerald-300'
  if (/^-/.test(part) && /%/.test(part)) return 'text-red-300'
  if (/%/.test(part)) return 'text-amber-300'
  if (/USD|US\$|\d/.test(part)) return 'text-sky-300'
  return 'text-cyan-300'
}

const OBSERVE_TODAY_SPEECH_ID = 'tendencias-observe-today'

function ObserveTodayPanel({
  text,
  periodLabel,
  tone,
  score,
}: {
  text: string
  periodLabel: string
  tone: string
  score: number
}) {
  const parts = text.split(ANALYSIS_HIGHLIGHT_RE)
  const speakText = useMemo(() => {
    const clean = text.replace(/\s+/g, ' ').trim()
    return `O que observar hoje. Score de tendência ${score} de 100. ${clean}`
  }, [text, score])

  const speaking = useSyncExternalStore(
    subscribeGfSpeech,
    () => getGfSpeechActiveId() === OBSERVE_TODAY_SPEECH_ID,
    () => false,
  )

  return (
    <Card className="relative overflow-hidden border-yellow-500/30 bg-gradient-to-br from-yellow-500/[0.12] via-card to-amber-950/20 animate-tendencias-glow">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-400/80 to-transparent animate-tendencias-shimmer"
        aria-hidden
      />
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight sm:text-lg">
            <span className="flex items-center gap-1.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-500/20 ring-1 ring-yellow-500/35">
                <Zap className="h-5 w-5 text-yellow-400 animate-pulse" />
              </span>
              {isGfSpeechSupported() ? (
                <button
                  type="button"
                  onClick={() => {
                    primeGfSpeechVoices()
                    toggleGfSpeech(OBSERVE_TODAY_SPEECH_ID, speakText)
                  }}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-yellow-500/60',
                    speaking
                      ? 'border-yellow-500/50 bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/35'
                      : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20',
                  )}
                  title={speaking ? 'Parar leitura' : 'Ouvir resumo do mercado'}
                  aria-label={speaking ? 'Parar leitura do resumo' : 'Ouvir resumo do mercado'}
                  aria-pressed={speaking}
                >
                  <Volume2 className="h-4 w-4" strokeWidth={2.25} />
                </button>
              ) : null}
            </span>
            O que observar hoje
          </CardTitle>
          <Badge
            variant="outline"
            className="border-yellow-500/40 bg-yellow-500/10 px-2.5 py-1 font-mono text-sm font-bold text-yellow-300 tabular-nums"
          >
            {score}/100
          </Badge>
        </div>
        <p className="text-xs font-medium text-yellow-200/80">Análise do mercado · leitura rápida</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-base font-medium leading-[1.8] tracking-wide text-foreground/95 sm:text-lg sm:leading-[1.85]">
          {parts.map((part, i) =>
            part && isAnalysisHighlight(part) ? (
              <span key={i} className={cn('font-extrabold tabular-nums', highlightClass(part))}>
                {part}
              </span>
            ) : (
              <span key={i} className="text-foreground/90">
                {part}
              </span>
            ),
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 border-t border-yellow-500/15 pt-3">
          <Badge variant="secondary" className="text-[10px] font-medium">
            {periodLabel}
          </Badge>
          <Badge variant="outline" className="border-border/50 text-[10px] capitalize text-muted-foreground">
            Tom {tone}
          </Badge>
          <span className="text-[10px] text-muted-foreground">Números e % em destaque</span>
        </div>
      </CardContent>
    </Card>
  )
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
    <div className="group rounded-xl border border-border/50 bg-card/50 px-3 py-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:bg-card/80 hover:shadow-lg hover:shadow-black/20">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 truncate font-mono text-xl font-extrabold tabular-nums transition-transform duration-300 group-hover:scale-[1.03]',
          accent === 'gold' && 'text-yellow-400',
          accent === 'up' && 'text-emerald-400',
          accent === 'down' && 'text-red-400',
          !accent && 'text-foreground',
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">{sub}</p>}
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
      <div className="h-2 overflow-hidden rounded-full bg-muted/40">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out animate-tendencias-pulse-bar',
            level === 'optimista' && 'bg-gradient-to-r from-emerald-600 to-emerald-400',
            level === 'pessimista' && 'bg-gradient-to-r from-red-600 to-red-400',
            level === 'neutro' && 'bg-gradient-to-r from-amber-600 to-amber-400',
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

function equityHref(row: TendenciasEquityRow): string {
  if (row.xstockId) {
    return `https://www.coingecko.com/en/coins/${encodeURIComponent(row.xstockId)}`
  }
  return `https://finance.yahoo.com/quote/${encodeURIComponent(row.symbol)}`
}

function EquityHighlightCard({ row }: { row: TendenciasEquityRow }) {
  const up = (row.changePct ?? 0) >= 0
  return (
    <a
      href={equityHref(row)}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-w-0 flex-col rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-950/35 via-card/90 to-background p-4 transition-all hover:border-blue-500/45 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-blue-400/90">Ação US</p>
          <p className="mt-0.5 truncate text-sm font-bold text-foreground">{row.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.symbol}</p>
        </div>
        <Badge variant="outline" className={cn('shrink-0 text-[9px]', EQUITY_SECTOR_CLASS[row.sectorTag])}>
          {EQUITY_SECTOR_LABEL[row.sectorTag]}
        </Badge>
      </div>
      <p className="mt-3 font-mono text-xl font-bold tabular-nums tracking-tight">{fmtUsd(row.price)}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Hoje</span>
        <span className={cn('font-semibold tabular-nums', up ? 'text-emerald-400' : 'text-red-400')}>
          {fmtPct(row.changePct)}
        </span>
      </div>
      {row.volume != null && (
        <p className="mt-2 text-[10px] text-muted-foreground">Volume · {fmtUsd(row.volume, true)}</p>
      )}
      {row.xstockId && (
        <p className="mt-2 text-[10px] text-blue-300/80">Também no Mercado (xStock)</p>
      )}
    </a>
  )
}

function EquityTableRow({ row }: { row: TendenciasEquityRow }) {
  const up = (row.changePct ?? 0) >= 0
  return (
    <tr className="border-b border-border/30 transition-colors hover:bg-muted/10">
      <td className="px-2 py-2.5">
        <a
          href={equityHref(row)}
          target="_blank"
          rel="noopener noreferrer"
          className="block min-w-0 hover:text-yellow-500"
        >
          <p className="font-semibold leading-none">{row.symbol}</p>
          <p className="truncate text-[10px] text-muted-foreground">{row.name}</p>
        </a>
      </td>
      <td className="hidden px-2 py-2.5 sm:table-cell">
        <Badge variant="outline" className={cn('text-[9px]', EQUITY_SECTOR_CLASS[row.sectorTag])}>
          {EQUITY_SECTOR_LABEL[row.sectorTag]}
        </Badge>
      </td>
      <td className="px-2 py-2.5 text-right font-mono text-xs tabular-nums">{fmtUsd(row.price)}</td>
      <td className="px-2 py-2.5 text-right">
        <span className={cn('font-mono text-xs font-medium tabular-nums', up ? 'text-emerald-400' : 'text-red-400')}>
          {fmtPct(row.changePct)}
        </span>
      </td>
      <td className="hidden px-2 py-2.5 text-right font-mono text-[10px] tabular-nums text-muted-foreground md:table-cell">
        {fmtUsd(row.volume, true)}
      </td>
      <td className="hidden px-2 py-2.5 text-right font-mono text-[10px] tabular-nums text-muted-foreground lg:table-cell">
        {fmtUsd(row.marketCap, true)}
      </td>
    </tr>
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
        'rounded-lg border px-3 py-2.5 text-xs transition-all duration-200 hover:translate-x-0.5',
        alert.severity === 'urgent' && 'border-red-500/40 bg-red-950/20 hover:border-red-500/60',
        alert.severity === 'watch' && 'border-amber-500/30 bg-amber-950/15 hover:border-amber-500/50',
        alert.severity === 'info' && 'border-border/40 bg-muted/10 hover:bg-muted/20',
      )}
    >
      <p className="font-semibold text-foreground">{alert.title}</p>
      <p className="mt-1 leading-relaxed text-muted-foreground">{alert.detail}</p>
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
  const [mentionFilter, setMentionFilter] = useState<NewsMentionFilter | null>(null)
  useEffect(() => {
    setPrefs(readTendenciasPrefs())
    setMounted(true)
  }, [])

  useEffect(() => {
    if (tab !== 'noticias') setMentionFilter(null)
  }, [tab])

  const savePrefs = useCallback((p: TendenciasPrefs) => {
    setPrefs(p)
    writeTendenciasPrefs(p)
  }, [])

  const { data, isLoading, isError, refetch, isFetching, refreshTendencias } = useTendencias(prefs)
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

  const displayedNewsHeadlines = useMemo(() => {
    const all = data?.news.headlines ?? []
    if (mentionFilter) {
      return all.filter((h) => headlineMatchesMention(h, mentionFilter))
    }
    return all.slice(0, NEWS_HEADLINES_DEFAULT)
  }, [data?.news.headlines, mentionFilter])

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

  const { market, observeToday, news, narratives, buckets, alerts, defi, equities, meta } = data
  const sourcesLabel = meta.dataSources?.join(' · ') ?? 'coingecko · defillama'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Tendências · cripto e ações US</h2>
          <p className="text-xs text-muted-foreground">
            {SCORE_TENDENCIA_NOME} · tokens e bolsa americana · {sourcesLabel}
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
            onClick={() => void refreshTendencias()}
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
      <div className="tendencias-stagger grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              'relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all duration-200',
              tab === id
                ? 'scale-[1.02] bg-background text-foreground shadow-md ring-1 ring-yellow-500/25'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
            )}
          >
            <Icon className={cn('h-3.5 w-3.5 transition-colors', tab === id && 'text-yellow-400')} />
            {label}
            {tab === id ? (
              <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-yellow-500/80" aria-hidden />
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab: Visão geral */}
      {tab === 'visao' && (
        <div className="animate-fade-in space-y-6">
          <ObserveTodayPanel
            text={observeToday}
            periodLabel={PERIOD_LABEL[meta.momentumPeriod]}
            tone={meta.analysisTone}
            score={market.trimMarketScore}
          />

          <section className="space-y-4 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 via-card/40 to-background p-4 shadow-inner sm:p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Mercado cripto</h3>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/50 bg-card/40">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Alertas (tokens)
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
                  <CardTitle className="text-sm">Sentimento cripto</CardTitle>
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
                <p className="mb-2 text-xs font-medium text-muted-foreground">Narrativas cripto activas</p>
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
          </section>

          {equities && equities.highlights.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-semibold tracking-tight text-foreground">Mercado acionário EUA</h3>
              </div>
              <Card className="border-blue-500/20 bg-gradient-to-br from-card to-blue-500/[0.04]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold">
                    <span>Ações americanas em destaque</span>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setTab('acoes')}>
                      Ver tudo →
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">{equities.summary}</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {equities.highlights.slice(0, 4).map((r) => (
                      <EquityHighlightCard key={r.symbol} row={r} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>
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

      {/* Tab: Ações US */}
      {tab === 'acoes' && (
        <div className="space-y-4">
          {!equities ||
          (equities.highlights.length === 0 &&
            equities.aiWatchlist.length === 0 &&
            equities.topVolume.length === 0) ? (
            <Card className="border-border/50 bg-card/40">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                <Building2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                <p>A carregar cotações de ações…</p>
                <p className="mt-1 text-xs">
                  Se persistir, verifica a ligação ou <span className="font-mono">FMP_API_KEY</span> na Vercel (opcional;
                  sem chave usamos xStock via CoinGecko).
                </p>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
                  Actualizar
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="rounded-lg border border-blue-500/20 bg-blue-950/15 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {equities.summary}
              </p>

              {equities.highlights.length > 0 && (
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Em destaque hoje
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {equities.highlights.map((r) => (
                      <EquityHighlightCard key={`hi-${r.symbol}`} row={r} />
                    ))}
                  </div>
                </div>
              )}

              {equities.aiWatchlist.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    IA e tecnologia
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-border/50 bg-card/30">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-border/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-2 py-2 font-medium">Ticker</th>
                          <th className="hidden px-2 py-2 font-medium sm:table-cell">Sector</th>
                          <th className="px-2 py-2 text-right font-medium">Preço</th>
                          <th className="px-2 py-2 text-right font-medium">Variação</th>
                          <th className="hidden px-2 py-2 text-right font-medium md:table-cell">Volume</th>
                          <th className="hidden px-2 py-2 text-right font-medium lg:table-cell">Cap.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {equities.aiWatchlist.map((r) => (
                          <EquityTableRow key={`ai-${r.symbol}`} row={r} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {equities.topVolume.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Maior volume (mercado EUA)
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-border/50 bg-card/30">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-border/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-2 py-2 font-medium">Ticker</th>
                          <th className="hidden px-2 py-2 font-medium sm:table-cell">Sector</th>
                          <th className="px-2 py-2 text-right font-medium">Preço</th>
                          <th className="px-2 py-2 text-right font-medium">Variação</th>
                          <th className="hidden px-2 py-2 text-right font-medium md:table-cell">Volume</th>
                          <th className="hidden px-2 py-2 text-right font-medium lg:table-cell">Cap.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {equities.topVolume.map((r) => (
                          <EquityTableRow key={`vol-${r.symbol}`} row={r} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <p className="text-center text-[10px] text-muted-foreground">
                Fonte: Financial Modeling Prep · referência, não é recomendação de investimento.
              </p>
            </>
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
            <NewsTopMentionsSection
              topCrypto={
                news.topCryptoMentions?.length ? news.topCryptoMentions : news.topMentions
              }
              topStocks={news.topStockMentions ?? []}
              period={news.rankingPeriod ?? period}
              mentionFilter={mentionFilter}
              onMentionFilter={setMentionFilter}
            />
            <ul className="space-y-3">
              {news.headlines.length === 0 ? (
                <li className="text-lg leading-snug text-muted-foreground">
                  Sem manchetes em português no momento. Clica em Actualizar ou aguarda ~1 minuto.
                </li>
              ) : displayedNewsHeadlines.length === 0 && mentionFilter ? (
                <li className="rounded-lg border border-border/30 bg-muted/5 px-3 py-3 text-sm text-muted-foreground">
                  Nenhuma manchete menciona {mentionFilter.symbol} neste conjunto.{' '}
                  <button
                    type="button"
                    className="font-medium text-yellow-500 hover:underline"
                    onClick={() => setMentionFilter(null)}
                  >
                    Ver todas
                  </button>
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
            {!mentionFilter &&
              (data?.news.headlines.length ?? 0) > displayedNewsHeadlines.length && (
                <p className="text-[11px] text-muted-foreground">
                  +{(data?.news.headlines.length ?? 0) - displayedNewsHeadlines.length} manchetes —{' '}
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
          <CardContent className="pt-4">
            <DefiTendenciasPanel defi={defi} />
          </CardContent>
        </Card>
      )}

      <p className="text-center text-[10px] text-muted-foreground">
        Actualizado {new Date(data.updatedAt).toLocaleString('pt-PT')}
      </p>
    </div>
  )
}
