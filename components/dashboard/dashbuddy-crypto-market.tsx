'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { openYieldscanSqlite } from '@/lib/client-db/sqlite-core'
import type { MercadoCoin, MarketApiPayload } from '@/lib/coingecko-market'
import { syntheticHighlightCoin } from '@/lib/coingecko-market'
import {
  highlightMetaFromPresetOrId,
  MERCADO_HIGHLIGHT_QUICK_PRESETS,
} from '@/lib/mercado-highlight-presets'
import { COINGECKO_LOGO_BY_ID } from '@/lib/coingecko-static-logos'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import {
  effectiveDisplayFiatForCoin,
  formatMercadoCap,
  formatMercadoFiatAmount,
  readMercadoDisplayPrefs,
  resolveMercadoDisplay,
  writeMercadoDisplayPrefs,
  type MercadoDisplayFiat,
  type MercadoDisplayPrefs,
  type MercadoPriceOverrides,
} from '@/lib/mercado-display-prefs'
import {
  canonicalHighlightCoinGeckoId,
  clearStoredHighlightIds,
  DEFAULT_MARKET_HIGHLIGHT_IDS,
  MAX_MARKET_HIGHLIGHTS,
  sanitizeHighlightIds,
  readStoredHighlightIds,
  writeStoredHighlightIds,
} from '@/lib/mercado-highlight-ids'
import { cn } from '@/lib/utils'
import { Coins, ExternalLink, LineChart, Plus, RefreshCw, Settings2, Trash2, TrendingUp } from 'lucide-react'

async function fetchMercado(ids: string[]): Promise<MarketApiPayload> {
  const q = `?highlights=${encodeURIComponent(ids.join(','))}`
  const res = await fetch(`/api/market${q}`)
  const json = (await res.json()) as MarketApiPayload
  return json
}

const FIAT_OPTIONS: { id: MercadoDisplayFiat; label: string; hint: string }[] = [
  { id: 'brl', label: 'Real', hint: 'BRL' },
  { id: 'usd', label: 'Dólar', hint: 'USD' },
  { id: 'eur', label: 'Euro', hint: 'EUR' },
]

function Variacao({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const up = value >= 0
  return (
    <span
      className={cn(
        'text-xs font-semibold tabular-nums',
        up ? 'text-emerald-400' : 'text-red-400'
      )}
    >
      {up ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  )
}

function coinThumbSrc(coin: MercadoCoin): string | null {
  return COINGECKO_LOGO_BY_ID[coin.id] ?? coin.image
}

function CoinThumb({ coin, size = 40 }: { coin: MercadoCoin; size?: number }) {
  const src = coinThumbSrc(coin)
  return (
    <TokenSymbolAvatar
      symbol={coin.symbol}
      coingeckoId={coin.id}
      iconUrl={src}
      size={size}
      className="bg-muted/40"
    />
  )
}

function CoinRowCard({
  coin,
  compact,
  mercadoPrefs,
}: {
  coin: MercadoCoin
  compact?: boolean
  mercadoPrefs: MercadoDisplayPrefs
}) {
  const href = `https://www.coingecko.com/en/coins/${encodeURIComponent(coin.id)}`
  const displayFiat = effectiveDisplayFiatForCoin(coin.id, mercadoPrefs)
  const q = resolveMercadoDisplay(coin, displayFiat, mercadoPrefs.priceOverrides)
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-border/50 bg-card/80 p-3 transition-colors hover:border-cyan-500/35 hover:bg-card',
        compact && 'p-2.5'
      )}
    >
      <CoinThumb coin={coin} size={compact ? 36 : 44} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-medium text-foreground">{coin.name}</span>
          <span className="shrink-0 text-[10px] uppercase text-muted-foreground">{coin.symbol}</span>
          {q.priceSource === 'override' && (
            <Badge
              variant="outline"
              className="h-4 border-amber-500/40 bg-amber-950/30 px-1 text-[9px] font-normal text-amber-200/90"
            >
              manual
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatMercadoFiatAmount(q.price, displayFiat)}
          </span>
          <Variacao value={q.change_24h} />
        </div>
        {!compact && q.market_cap != null && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Cap. mercado {formatMercadoCap(q.market_cap, displayFiat)}
          </p>
        )}
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
    </a>
  )
}

function HighlightCard({ coin, mercadoPrefs }: { coin: MercadoCoin; mercadoPrefs: MercadoDisplayPrefs }) {
  const href = `https://www.coingecko.com/en/coins/${encodeURIComponent(coin.id)}`
  const displayFiat = effectiveDisplayFiatForCoin(coin.id, mercadoPrefs)
  const q = resolveMercadoDisplay(coin, displayFiat, mercadoPrefs.priceOverrides)
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/40 via-card/90 to-background p-5 transition-all hover:border-cyan-500/45 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-cyan-400/90">Em destaque</p>
          <h3 className="mt-1 text-lg font-bold text-foreground">{coin.name}</h3>
          <p className="text-xs text-muted-foreground">{coin.symbol}</p>
        </div>
        <CoinThumb coin={coin} size={52} />
      </div>
      {q.priceSource === 'override' && (
        <Badge
          variant="outline"
          className="mt-2 w-fit border-amber-500/45 bg-amber-950/40 text-[10px] font-normal text-amber-200/95"
        >
          Valor manual
        </Badge>
      )}
      <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-foreground">
        {formatMercadoFiatAmount(q.price, displayFiat)}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">24h</span>
        <Variacao value={q.change_24h} />
      </div>
      {q.market_cap != null && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Capitalização · {formatMercadoCap(q.market_cap, displayFiat)}
        </p>
      )}
      <ExternalLink className="absolute right-4 top-4 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60" />
    </a>
  )
}

function SectionSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border/40 p-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

type OverrideTextDraft = Record<string, Partial<Record<MercadoDisplayFiat, string>>>

/** Por slug: 'default' = usa a moeda global do painel. */
type DraftPerCoinFiat = Record<string, MercadoDisplayFiat | 'default'>

function textsFromOverrides(o: MercadoPriceOverrides): OverrideTextDraft {
  const texts: OverrideTextDraft = {}
  for (const [id, slice] of Object.entries(o)) {
    const row: Partial<Record<MercadoDisplayFiat, string>> = {}
    for (const f of ['usd', 'brl', 'eur'] as const) {
      if (slice[f] != null && Number.isFinite(slice[f])) row[f] = String(slice[f])
    }
    if (Object.keys(row).length > 0) texts[id] = row
  }
  return texts
}

function coinForHighlightDisplay(
  coin: MercadoCoin | null,
  id: string,
  prefs: MercadoDisplayPrefs
): MercadoCoin | null {
  const slug = (coin?.id ?? canonicalHighlightCoinGeckoId(id)).trim().toLowerCase()
  if (!slug) return coin

  if (coin) {
    const fiat = effectiveDisplayFiatForCoin(slug, prefs)
    const q = resolveMercadoDisplay(coin, fiat, prefs.priceOverrides)
    if (q.price != null) return coin
  }

  const synthetic = syntheticHighlightCoin(slug)
  const fiat = effectiveDisplayFiatForCoin(slug, prefs)
  const q = resolveMercadoDisplay(synthetic, fiat, prefs.priceOverrides)
  if (q.price != null) return synthetic

  return coin
}

function HighlightEmptyCard({
  id,
  mercadoPrefs,
}: {
  id: string
  mercadoPrefs: MercadoDisplayPrefs
}) {
  const slug = canonicalHighlightCoinGeckoId(id)
  const meta = highlightMetaFromPresetOrId(slug)
  const synthetic = syntheticHighlightCoin(slug)
  const fiat = effectiveDisplayFiatForCoin(slug, mercadoPrefs)
  const q = resolveMercadoDisplay(synthetic, fiat, mercadoPrefs.priceOverrides)

  if (q.price != null) {
    return <HighlightCard coin={synthetic} mercadoPrefs={mercadoPrefs} />
  }

  return (
    <div className="flex min-h-[10rem] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-500/35 bg-amber-950/15 p-5 text-center">
      <TokenSymbolAvatar symbol={meta.symbol} coingeckoId={slug} size={48} />
      <div>
        <p className="font-semibold text-foreground">{meta.name}</p>
        <p className="text-xs text-muted-foreground">{meta.symbol}</p>
      </div>
      <p className="max-w-[14rem] text-xs leading-relaxed text-amber-200/90">
        Preço da CoinGecko indisponível. Confirma o slug{' '}
        <span className="font-mono text-foreground">{slug}</span> em ⚙ ou define preço manual em «Extra».
      </p>
    </div>
  )
}

function parseOverrideTexts(texts: OverrideTextDraft): MercadoPriceOverrides {
  const out: MercadoPriceOverrides = {}
  for (const [id, slice] of Object.entries(texts)) {
    const cur: Partial<Record<MercadoDisplayFiat, number>> = {}
    for (const f of ['usd', 'brl', 'eur'] as const) {
      const s = (slice[f] ?? '').trim().replace(/\s/g, '').replace(',', '.')
      if (!s) continue
      const n = Number(s)
      if (Number.isFinite(n) && n >= 0) cur[f] = n
    }
    if (Object.keys(cur).length > 0) out[id] = cur
  }
  return out
}

export function DashbuddyCryptoMarket() {
  const [highlightIds, setHighlightIds] = useState<string[]>(
    () => readStoredHighlightIds() ?? [...DEFAULT_MARKET_HIGHLIGHT_IDS]
  )
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [draftSlots, setDraftSlots] = useState<string[]>(() => [...DEFAULT_MARKET_HIGHLIGHT_IDS])
  const [displayPrefs, setDisplayPrefs] = useState(() => readMercadoDisplayPrefs())
  const [draftFiat, setDraftFiat] = useState<MercadoDisplayFiat>('usd')
  const [draftFiatByCoin, setDraftFiatByCoin] = useState<DraftPerCoinFiat>({})
  const [draftOverrideText, setDraftOverrideText] = useState<OverrideTextDraft>({})

  useEffect(() => {
    void openYieldscanSqlite().then(() => {
      // Carrega do SQLite quando disponível; caso o IDB ainda esteja vazio/indisponível,
      // o helper já faz fallback para localStorage.
      const hi = readStoredHighlightIds()
      if (hi && hi.length) setHighlightIds(hi)
      setDisplayPrefs(readMercadoDisplayPrefs())
    })
  }, [])

  const highlightsCacheKey = highlightIds.join('|')

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['crypto-market', highlightsCacheKey],
    queryFn: () => fetchMercado(highlightIds),
    staleTime: 55_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    gcTime: 120_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(15_000, 2_000 * 2 ** attempt),
  })

  const syncDraftFromIds = useCallback((ids: string[]) => {
    setDraftSlots(ids.length > 0 ? [...ids] : [...DEFAULT_MARKET_HIGHLIGHT_IDS])
  }, [])

  const syncSheetDrafts = useCallback(() => {
    const p = readMercadoDisplayPrefs()
    setDraftFiat(p.displayFiat)
    setDraftOverrideText(textsFromOverrides(p.priceOverrides))
    const ids = highlightIds.length > 0 ? highlightIds : [...DEFAULT_MARKET_HIGHLIGHT_IDS]
    const byCoin: DraftPerCoinFiat = {}
    for (const rawId of ids) {
      const k = String(rawId).trim().toLowerCase()
      if (!k) continue
      const mapped = p.displayFiatByCoinId[k]
      byCoin[k] = mapped != null && mapped !== p.displayFiat ? mapped : 'default'
    }
    setDraftFiatByCoin(byCoin)
  }, [highlightIds])

  useEffect(() => {
    if (prefsOpen) {
      syncDraftFromIds(highlightIds)
      syncSheetDrafts()
    }
  }, [prefsOpen, highlightIds, syncDraftFromIds, syncSheetDrafts])

  const saveAll = useCallback(() => {
    const cleaned = sanitizeHighlightIds(draftSlots.filter((s) => s.trim().length > 0))
    writeStoredHighlightIds(cleaned)
    setHighlightIds(cleaned)
    const overrides = parseOverrideTexts(draftOverrideText)
    const displayFiatByCoinId: MercadoDisplayPrefs['displayFiatByCoinId'] = {}
    for (const id of cleaned) {
      const mode = draftFiatByCoin[id] ?? 'default'
      if (mode !== 'default' && mode !== draftFiat) {
        displayFiatByCoinId[id] = mode
      }
    }
    const nextPrefs: MercadoDisplayPrefs = {
      displayFiat: draftFiat,
      displayFiatByCoinId,
      priceOverrides: overrides,
    }
    writeMercadoDisplayPrefs(nextPrefs)
    setDisplayPrefs(nextPrefs)
    setPrefsOpen(false)
  }, [draftSlots, draftFiat, draftFiatByCoin, draftOverrideText])

  const addPresetToSlots = useCallback((presetId: string) => {
    const canonical = canonicalHighlightCoinGeckoId(presetId)
    setDraftSlots((rows) => {
      if (rows.some((s) => canonicalHighlightCoinGeckoId(s) === canonical)) return rows
      const emptyIdx = rows.findIndex((s) => !s.trim())
      if (emptyIdx >= 0) {
        const next = [...rows]
        next[emptyIdx] = canonical
        return next
      }
      if (rows.length >= MAX_MARKET_HIGHLIGHTS) return rows
      return [...rows, canonical]
    })
  }, [])

  const restoreHighlightDefault = useCallback(() => {
    clearStoredHighlightIds()
    const d = [...DEFAULT_MARKET_HIGHLIGHT_IDS]
    const cleaned = sanitizeHighlightIds(d)
    writeStoredHighlightIds(cleaned)
    setHighlightIds(cleaned)
    syncDraftFromIds(cleaned)
  }, [syncDraftFromIds])

  const resetDisplayDraft = useCallback(() => {
    setDraftFiat('usd')
    setDraftFiatByCoin({})
    setDraftOverrideText({})
  }, [])

  const highlightCoins = data?.highlightCoins ?? []
  const displayFiatLive = displayPrefs.displayFiat
  const fiatLabel = FIAT_OPTIONS.find((x) => x.id === displayFiatLive)?.label ?? displayFiatLive.toUpperCase()
  const hasPerCoinFiat = Object.keys(displayPrefs.displayFiatByCoinId).length > 0

  return (
    <section className="space-y-8" aria-labelledby="mercado-cripto-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2.5">
              <LineChart className="h-5 w-5 text-cyan-400" />
              <h2 id="mercado-cripto-heading" className="text-2xl font-bold tracking-tight">
                Mercado
              </h2>
            </div>
            {/* modal={false}: Radix Dialog blocks pointer events on portaled Select dropdowns otherwise */}
            <Sheet modal={false} open={prefsOpen} onOpenChange={setPrefsOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted/50 hover:text-muted-foreground"
                  title="Moeda de exibição (mercado automático) e destaques"
                  aria-label="Abrir configuração do mercado"
                >
                  <Settings2 className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex h-full w-full flex-col gap-0 border-l border-cyan-500/25 bg-background/95 p-0 sm:max-w-lg"
              >
                <SheetHeader className="border-b border-border/60 px-6 py-4 text-left">
                  <SheetTitle className="text-lg font-semibold tracking-tight">Mercado</SheetTitle>
                  <SheetDescription className="text-sm text-muted-foreground">
                    Os preços <strong className="text-foreground">vêm sempre do mercado</strong> (CoinGecko). Tu só
                    escolhes <strong className="text-foreground">em que moeda queres ver</strong> (real, dólar ou euro) —{' '}
                    <strong className="text-foreground">não precisas de escrever nenhum valor</strong>. No fim:{' '}
                    <strong className="text-foreground">Guardar tudo</strong>.
                  </SheetDescription>
                </SheetHeader>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-5 px-6 py-5">
                    <section className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-4">
                      <p className="text-sm font-medium text-emerald-100/95">Isto não pede preço teu</p>
                      <p className="text-xs leading-relaxed text-emerald-50/85">
                        Se escolheres <strong className="text-emerald-50">Real (BRL)</strong>, a app mostra o valor{' '}
                        <strong className="text-emerald-50">já cotado em reais</strong> que a API traz — o mesmo para
                        dólar ou euro. Não há conversão manual nem campos obrigatórios de número para isso.
                      </p>
                    </section>

                    <section className="space-y-2 rounded-xl border border-cyan-500/20 bg-cyan-950/15 p-4">
                      <Label htmlFor="mercado-moeda-global" className="text-xs font-semibold text-foreground">
                        Onde escolher: moeda da página inteira
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Menu abaixo = preço do mercado em <strong className="text-foreground">R$</strong>,{' '}
                        <strong className="text-foreground">US$</strong> ou <strong className="text-foreground">€</strong>{' '}
                        em todo o Mercado (destaques, top 10, tendências).
                      </p>
                      <Select
                        value={draftFiat}
                        onValueChange={(v) => setDraftFiat(v as MercadoDisplayFiat)}
                      >
                        <SelectTrigger id="mercado-moeda-global" className="h-10 w-full">
                          <SelectValue placeholder="Moeda" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="brl">Real (BRL) — cotação do mercado</SelectItem>
                          <SelectItem value="usd">Dólar (USD) — cotação do mercado</SelectItem>
                          <SelectItem value="eur">Euro (EUR) — cotação do mercado</SelectItem>
                        </SelectContent>
                      </Select>
                    </section>

                    <section className="space-y-3">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Moedas em destaque
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Escreve o <strong className="text-foreground">slug CoinGecko</strong> (ex.{' '}
                          <span className="font-mono">bitcoin</span>, <span className="font-mono">tesla-xstock</span>,{' '}
                          <span className="font-mono">alphabet-xstock</span>). Ticker:{' '}
                          <span className="font-mono">TSLA</span>, <span className="font-mono">MSFT</span>,{' '}
                          <span className="font-mono">GOOGL</span>, <span className="font-mono">XOM</span>.
                        </p>
                        <div className="mt-3 space-y-2 rounded-lg border border-gold/25 bg-gold/5 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">
                            Sugestões rápidas (um clique)
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {MERCADO_HIGHLIGHT_QUICK_PRESETS.map((p) => (
                              <Button
                                key={p.id}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 border-gold/30 bg-background/80 px-2 text-[11px] hover:border-gold/50"
                                disabled={draftSlots.length >= MAX_MARKET_HIGHLIGHTS}
                                title={`${p.name} (${p.symbol}) — slug: ${p.id}`}
                                onClick={() => addPresetToSlots(p.id)}
                              >
                                <TokenSymbolAvatar symbol={p.symbol} coingeckoId={p.id} size={18} />
                                {p.name}
                              </Button>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Depois de adicionar, usa «Extra» abaixo só se quiseres um preço à mão (mapa BRL/USD/EUR).
                          </p>
                        </div>
                        <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
                          {draftSlots.filter((s) => s.trim().length > 0).length}/{MAX_MARKET_HIGHLIGHTS} linhas
                        </p>
                      </div>
                      <div className="max-h-[min(48vh,20rem)] space-y-3 overflow-y-auto pr-1">
                        {draftSlots.map((slot, i) => {
                          const trimmed = slot.trim()
                          const rowKey =
                            trimmed.length > 0
                              ? canonicalHighlightCoinGeckoId(trimmed) || trimmed.toLowerCase()
                              : ''
                          const perMode: MercadoDisplayFiat | 'default' =
                            rowKey && draftFiatByCoin[rowKey] ? draftFiatByCoin[rowKey]! : 'default'
                          const perSelect = perMode === 'default' ? 'default' : perMode
                          return (
                            <div
                              key={i}
                              className="space-y-3 rounded-lg border border-border/50 bg-card/50 p-3"
                            >
                              <div className="flex items-end gap-2">
                                <div className="min-w-0 flex-1 space-y-1">
                                  <Label htmlFor={`mercado-slot-${i}`} className="text-[11px] text-muted-foreground">
                                    Ativo {i + 1}
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    {rowKey ? (
                                      <TokenSymbolAvatar
                                        symbol={
                                          highlightMetaFromPresetOrId(rowKey).symbol
                                        }
                                        coingeckoId={rowKey}
                                        size={28}
                                      />
                                    ) : null}
                                  <Input
                                    id={`mercado-slot-${i}`}
                                    className="h-9 flex-1 font-mono text-xs"
                                    placeholder="ex.: nasdaq-xstock, nvidia-xstock"
                                    value={slot}
                                    onChange={(e) => {
                                      const next = [...draftSlots]
                                      next[i] = e.target.value
                                      setDraftSlots(next)
                                    }}
                                    autoComplete="off"
                                    spellCheck={false}
                                  />
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                                  disabled={draftSlots.length <= 1}
                                  title="Remover"
                                  aria-label={`Remover linha ${i + 1}`}
                                  onClick={() =>
                                    setDraftSlots((rows) => (rows.length <= 1 ? rows : rows.filter((_, j) => j !== i)))
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              {rowKey ? (
                                <div className="space-y-1">
                                  <Label className="text-[11px] text-muted-foreground">
                                    Só este cartão — preço do mercado em{' '}
                                    <span className="font-mono text-cyan-600/90 dark:text-cyan-400/90">({rowKey})</span>
                                  </Label>
                                  <Select
                                    value={perSelect}
                                    onValueChange={(v) => {
                                      const val = v as MercadoDisplayFiat | 'default'
                                      setDraftFiatByCoin((prev) => ({
                                        ...prev,
                                        [rowKey]: val === 'default' ? 'default' : val,
                                      }))
                                    }}
                                  >
                                    <SelectTrigger className="h-9 w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="default">Igual ao menu «moeda da página»</SelectItem>
                                      <SelectItem value="brl">Real (BRL), mercado</SelectItem>
                                      <SelectItem value="usd">Dólar (USD), mercado</SelectItem>
                                      <SelectItem value="eur">Euro (EUR), mercado</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 w-full gap-1.5 text-xs"
                        disabled={draftSlots.length >= MAX_MARKET_HIGHLIGHTS}
                        onClick={() =>
                          setDraftSlots((rows) => (rows.length >= MAX_MARKET_HIGHLIGHTS ? rows : [...rows, '']))
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar linha
                      </Button>
                    </section>

                    <details className="group rounded-xl border border-border/50 bg-muted/15 [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/25">
                        <span>Extra (ignora na maior parte dos casos) — escrever um preço à mão</span>
                        <span className="text-xs font-normal text-muted-foreground group-open:hidden">abrir</span>
                        <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">fechar</span>
                      </summary>
                      <div className="border-t border-border/40 px-4 pb-4 pt-2">
                        <p className="text-xs text-muted-foreground">
                          Isto <strong className="text-foreground">não é</strong> para escolher real/dólar/euro. Só serve
                          se quiseres <strong className="text-foreground">inventar um número</strong> em vez do mercado.
                          Vazio = usa sempre a CoinGecko.
                        </p>
                        <div className="mt-3 space-y-3">
                          {draftSlots.some((s) => s.trim().length > 0) ? (
                            draftSlots.map((slot, i) => {
                              const trimmed = slot.trim()
                              if (!trimmed) return null
                              const rowKey = canonicalHighlightCoinGeckoId(trimmed) || trimmed.toLowerCase()
                              return (
                                <div
                                  key={`ov-${i}-${rowKey}`}
                                  className="rounded-lg border border-border/40 bg-background/80 p-3"
                                >
                                  <p className="font-mono text-[11px] text-muted-foreground">{rowKey}</p>
                                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    {FIAT_OPTIONS.map((f) => (
                                      <div key={f.id} className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">{f.hint}</Label>
                                        <Input
                                          className="h-8 font-mono text-xs"
                                          inputMode="decimal"
                                          placeholder="—"
                                          autoComplete="off"
                                          spellCheck={false}
                                          value={draftOverrideText[rowKey]?.[f.id] ?? ''}
                                          onChange={(e) => {
                                            const v = e.target.value
                                            setDraftOverrideText((prev) => ({
                                              ...prev,
                                              [rowKey]: { ...prev[rowKey], [f.id]: v },
                                            }))
                                          }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            })
                          ) : (
                            <p className="text-xs italic text-muted-foreground">
                              Preenche um ativo em destaque acima para usar isto.
                            </p>
                          )}
                        </div>
                      </div>
                    </details>
                  </div>
                </ScrollArea>

                <SheetFooter className="flex-col gap-3 border-t border-border/60 bg-background/95 px-6 py-4">
                  <p className="text-center text-[11px] text-muted-foreground sm:text-left">
                    Só grava quando carregares em <strong className="text-foreground">Guardar tudo</strong>.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="ghost" className="h-9 text-xs" onClick={resetDisplayDraft}>
                        Repor moeda e valores manuais
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-9 text-xs"
                        onClick={restoreHighlightDefault}
                      >
                        Padrão destaques
                      </Button>
                    </div>
                    <Button type="button" size="default" className="h-10 w-full font-semibold sm:w-auto sm:min-w-[10rem]" onClick={saveAll}>
                      Guardar tudo
                    </Button>
                  </div>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Valores da CoinGecko (mercado). A ver em <span className="font-medium text-foreground">{fiatLabel}</span> — só
            escolhes a moeda nas definições; <span className="text-foreground/90">não precisas de introduzir preços</span>.
            {hasPerCoinFiat ? <> Alguns cartões têm moeda própria.</> : null}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 self-start border-cyan-500/30 hover:border-cyan-400/50"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      {data?.partial && data.erro && (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-200/90"
          role="status"
        >
          {data.erro}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-950/20 px-4 py-3 text-sm text-red-200/90">
          Não foi possível carregar o mercado. Tenta actualizar dentro de um minuto.
        </div>
      )}

      {isLoading && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: Math.min(MAX_MARKET_HIGHLIGHTS, Math.max(4, highlightIds.length)) }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
          <SectionSkeleton />
        </div>
      )}

      {!isLoading && data && (
        <>
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Moedas em destaque
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {highlightCoins.map((coin, i) => {
                const id = data.highlightIds[i] ?? ''
                const displayCoin = coinForHighlightDisplay(coin, id, displayPrefs)
                if (displayCoin) {
                  return (
                    <HighlightCard
                      key={`${displayCoin.id}-${i}`}
                      coin={displayCoin}
                      mercadoPrefs={displayPrefs}
                    />
                  )
                }
                return (
                  <HighlightEmptyCard
                    key={`empty-${id || i}`}
                    id={id}
                    mercadoPrefs={displayPrefs}
                  />
                )
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Coins className="h-4 w-4 text-cyan-500/80" />
              Top 10 por capitalização
            </h3>
            {data.top10.length === 0 ? (
              <p className="text-sm text-muted-foreground">Lista indisponível.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {data.top10.map((c) => (
                  <CoinRowCard key={c.id} coin={c} compact mercadoPrefs={displayPrefs} />
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-amber-500/80" />
              Em tendência (CoinGecko)
            </h3>
            {data.trending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Trending indisponível.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {data.trending.map((c) => (
                  <CoinRowCard key={`t-${c.id}-${c.symbol}`} coin={c} compact mercadoPrefs={displayPrefs} />
                ))}
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-muted-foreground/70">
            Fonte: CoinGecko API pública · <span className="tabular-nums">{data.fonte}</span> · última resposta{' '}
            {data.cachedAt ? new Date(data.cachedAt).toLocaleString('pt-PT') : '—'}
          </p>
        </>
      )}
    </section>
  )
}
