'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MercadoCardFiatMenu } from '@/components/dashboard/mercado-card-fiat-menu'
import { MercadoFavoritesSheet } from '@/components/dashboard/mercado-favorites-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { whenYieldscanSqliteReady } from '@/lib/client-db/sqlite-core'
import {
  readMercadoSessionCache,
  writeMercadoSessionCache,
} from '@/lib/mercado-session-cache'
import type { MercadoCoin, MarketApiPayload } from '@/lib/coingecko-market'
import type { TendenciasEquityRow } from '@/lib/tendencias/types'
import { syntheticHighlightCoin, withDisplayQuotes } from '@/lib/coingecko-market'
import { highlightMetaFromPresetOrId } from '@/lib/mercado-highlight-presets'
import { COINGECKO_LOGO_BY_ID } from '@/lib/coingecko-static-logos'
import { readHighlightIconUrl, writeHighlightIconUrl } from '@/lib/mercado-highlight-icons'
import { sanitizeMercadoErro } from '@/lib/mercado-erro'
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
} from '@/lib/mercado-display-prefs'
import {
  canonicalHighlightCoinGeckoId,
  DEFAULT_MARKET_HIGHLIGHT_IDS,
  MAX_MARKET_HIGHLIGHTS,
  readStoredHighlightIds,
  writeStoredHighlightIds,
} from '@/lib/mercado-highlight-ids'
import { isUsEquityXstock, MARKET_PINNED_STOCK_IDS } from '@/lib/us-equities'
import { cn } from '@/lib/utils'
import { Building2, Coins, ExternalLink, LineChart, Plus, RefreshCw, TrendingUp } from 'lucide-react'

async function fetchMercado(ids: string[]): Promise<MarketApiPayload> {
  const q = `?highlights=${encodeURIComponent(ids.join(','))}`
  const res = await fetch(`/api/market${q}`)
  const json = (await res.json()) as MarketApiPayload
  return { ...json, erro: sanitizeMercadoErro(json.erro) }
}

function coinThumbSrc(coin: MercadoCoin): string | null {
  return readHighlightIconUrl(coin.id) ?? COINGECKO_LOGO_BY_ID[coin.id] ?? coin.image
}

function highlightNeedsIconFetch(id: string, coin: MercadoCoin | null | undefined): boolean {
  if (readHighlightIconUrl(id)) return false
  if (COINGECKO_LOGO_BY_ID[id]) return false
  if (coin?.image?.trim()) return false
  return true
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

function stockTrendHref(row: TendenciasEquityRow): string {
  if (row.xstockId) {
    return `https://www.coingecko.com/en/coins/${encodeURIComponent(row.xstockId)}`
  }
  return `https://finance.yahoo.com/quote/${encodeURIComponent(row.symbol)}`
}

function StockTrendRowCard({ row }: { row: TendenciasEquityRow }) {
  const up = (row.changePct ?? 0) >= 0
  return (
    <a
      href={stockTrendHref(row)}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-border/50 bg-card/80 p-2.5 transition-colors hover:border-blue-500/35 hover:bg-card"
    >
      <TokenSymbolAvatar symbol={row.symbol} coingeckoId={row.xstockId} size={36} className="bg-muted/40" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-medium text-foreground">{row.name}</span>
          <span className="shrink-0 text-[10px] uppercase text-muted-foreground">{row.symbol}</span>
        </div>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Preço
        </p>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="max-w-full break-words text-sm font-semibold tabular-nums leading-tight text-foreground">
            {formatMercadoFiatAmount(row.price, 'usd')}
          </span>
          <span
            className={cn(
              'text-xs font-semibold tabular-nums',
              up ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {row.changePct != null && Number.isFinite(row.changePct)
              ? `${up ? '+' : ''}${row.changePct.toFixed(2)}%`
              : '—'}
          </span>
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
    </a>
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
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Preço
        </p>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="max-w-full break-words text-sm font-semibold tabular-nums leading-tight text-foreground">
            {formatMercadoFiatAmount(q.price, displayFiat)}
          </span>
          <Variacao value={q.change_24h} />
        </div>
        {!compact && q.market_cap != null && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Capitalização {formatMercadoCap(q.market_cap, displayFiat)}
          </p>
        )}
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
    </a>
  )
}

function HighlightCard({
  coin,
  mercadoPrefs,
  stock,
  onFiatChange,
}: {
  coin: MercadoCoin
  mercadoPrefs: MercadoDisplayPrefs
  stock?: boolean
  onFiatChange: (coinId: string, mode: MercadoDisplayFiat | 'default') => void
}) {
  const href = `https://www.coingecko.com/en/coins/${encodeURIComponent(coin.id)}`
  const displayFiat = effectiveDisplayFiatForCoin(coin.id, mercadoPrefs)
  const q = resolveMercadoDisplay(coin, displayFiat, mercadoPrefs.priceOverrides)
  const priceLabel = formatMercadoFiatAmount(q.price, displayFiat)
  return (
    <div
      className={cn(
        'group relative flex min-w-0 flex-col rounded-2xl border bg-gradient-to-br via-card/90 to-background p-3 transition-all hover:shadow-lg sm:p-5',
        stock
          ? 'border-blue-500/25 from-blue-950/40 hover:border-blue-500/45'
          : 'border-cyan-500/25 from-cyan-950/40 hover:border-cyan-500/45',
      )}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 z-0 rounded-2xl"
        aria-label={`Abrir ${coin.name} na CoinGecko`}
      />
      <div className="relative z-10 pointer-events-none flex items-start gap-1.5 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-[9px] font-medium uppercase tracking-wide sm:text-[11px]',
              stock ? 'text-blue-400/90' : 'text-cyan-400/90',
            )}
          >
            {stock ? 'Ação US · favorito' : 'Favorito'}
          </p>
          <h3 className="mt-0.5 truncate text-xs font-bold text-foreground sm:mt-1 sm:text-lg">
            {coin.name}
          </h3>
          <p className="truncate text-[10px] text-muted-foreground sm:text-xs">{coin.symbol}</p>
          {stock && (
            <Badge
              variant="outline"
              className="mt-1 h-4 border-blue-500/40 bg-blue-950/40 px-1 text-[9px] font-normal text-blue-200/95"
            >
              Ação US · tokenizado
            </Badge>
          )}
        </div>
        <CoinThumb coin={coin} size={32} />
      </div>
      {q.priceSource === 'override' && (
        <Badge
          variant="outline"
          className="relative z-10 mt-2 w-fit border-amber-500/45 bg-amber-950/40 text-[10px] font-normal text-amber-200/95 pointer-events-none"
        >
          Preço manual
        </Badge>
      )}
      <p className="relative z-10 mt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground pointer-events-none sm:mt-3">
        Preço
      </p>
      <p className="relative z-10 mt-0.5 w-full min-w-0 break-words text-[clamp(0.75rem,4.2vw,1.875rem)] font-bold leading-tight tabular-nums tracking-tight text-foreground pointer-events-none">
        {priceLabel}
      </p>
      <div className="relative z-10 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 pointer-events-none sm:mt-2">
        <span className="text-[10px] text-muted-foreground sm:text-xs">24h</span>
        <Variacao value={q.change_24h} />
      </div>
      {q.market_cap != null && (
        <p className="relative z-10 mt-2 break-words text-[10px] leading-snug text-muted-foreground pointer-events-none sm:mt-3 sm:text-[11px]">
          Capitalização · {formatMercadoCap(q.market_cap, displayFiat)}
        </p>
      )}
      <div className="relative z-20 mt-2 flex justify-end sm:mt-3">
        <MercadoCardFiatMenu
          coinId={coin.id}
          mercadoPrefs={mercadoPrefs}
          onFiatChange={onFiatChange}
          accent={stock ? 'stock' : 'crypto'}
        />
      </div>
      <ExternalLink className="absolute right-3 top-3 z-10 hidden h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60 pointer-events-none sm:right-4 sm:block" />
    </div>
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

function withStoredHighlightImage(coin: MercadoCoin): MercadoCoin {
  const stored = readHighlightIconUrl(coin.id)
  if (!stored) return coin
  return { ...coin, image: coin.image?.trim() ? coin.image : stored }
}

function coinForHighlightDisplay(
  coin: MercadoCoin | null,
  id: string,
  prefs: MercadoDisplayPrefs
): MercadoCoin | null {
  const slug = (coin?.id ?? canonicalHighlightCoinGeckoId(id)).trim().toLowerCase()
  if (!slug) return coin

  if (coin) {
    const enriched = withDisplayQuotes(withStoredHighlightImage(coin))
    const fiat = effectiveDisplayFiatForCoin(slug, prefs)
    const q = resolveMercadoDisplay(enriched, fiat, prefs.priceOverrides)
    if (q.price != null) return enriched
  }

  const synthetic = withStoredHighlightImage(syntheticHighlightCoin(slug))
  const fiat = effectiveDisplayFiatForCoin(slug, prefs)
  const q = resolveMercadoDisplay(synthetic, fiat, prefs.priceOverrides)
  if (q.price != null) return synthetic

  return coin ? withStoredHighlightImage(coin) : coin
}

function HighlightEmptyCard({
  id,
  mercadoPrefs,
  onFiatChange,
}: {
  id: string
  mercadoPrefs: MercadoDisplayPrefs
  onFiatChange: (coinId: string, mode: MercadoDisplayFiat | 'default') => void
}) {
  const slug = canonicalHighlightCoinGeckoId(id)
  const meta = highlightMetaFromPresetOrId(slug)
  const synthetic = syntheticHighlightCoin(slug)
  const fiat = effectiveDisplayFiatForCoin(slug, mercadoPrefs)
  const q = resolveMercadoDisplay(synthetic, fiat, mercadoPrefs.priceOverrides)

  if (q.price != null) {
    return <HighlightCard coin={synthetic} mercadoPrefs={mercadoPrefs} onFiatChange={onFiatChange} />
  }

  return (
    <div className="relative flex min-h-[10rem] flex-col rounded-2xl border border-dashed border-amber-500/35 bg-amber-950/15 p-5">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <TokenSymbolAvatar
        symbol={meta.symbol}
        coingeckoId={slug}
        iconUrl={readHighlightIconUrl(slug)}
        size={48}
      />
      <div>
        <p className="font-semibold text-foreground">{meta.name}</p>
        <p className="text-xs text-muted-foreground">{meta.symbol}</p>
      </div>
      <p className="max-w-[14rem] text-xs leading-relaxed text-amber-200/90">
        Preço da CoinGecko indisponível. Tenta «Actualizar» ou edita os favoritos.
      </p>
      </div>
      <div className="mt-2 flex justify-end">
        <MercadoCardFiatMenu coinId={slug} mercadoPrefs={mercadoPrefs} onFiatChange={onFiatChange} />
      </div>
    </div>
  )
}

export function DashbuddyCryptoMarket() {
  const [highlightIds, setHighlightIds] = useState<string[]>(
    () => readStoredHighlightIds() ?? [...DEFAULT_MARKET_HIGHLIGHT_IDS],
  )
  const [favSheetOpen, setFavSheetOpen] = useState(false)
  const [displayPrefs, setDisplayPrefs] = useState(() => readMercadoDisplayPrefs())
  const [iconRefresh, setIconRefresh] = useState(0)
  const iconsFetchedFor = useRef('')

  useEffect(() => {
    void whenYieldscanSqliteReady().then(() => {
      const hi = readStoredHighlightIds()
      if (hi?.length) {
        setHighlightIds((prev) => (hi.join('|') === prev.join('|') ? prev : hi))
      }
      setDisplayPrefs(readMercadoDisplayPrefs())
    })
  }, [])

  const pinnedStockIds = [...MARKET_PINNED_STOCK_IDS]

  const allMarketIds = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const id of [...highlightIds, ...MARKET_PINNED_STOCK_IDS]) {
      const k = id.trim()
      if (k && !seen.has(k)) {
        seen.add(k)
        out.push(k)
      }
    }
    return out
  }, [highlightIds])

  const marketQueryKey = allMarketIds.join('|')

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['crypto-market', marketQueryKey],
    queryFn: async () => {
      const payload = await fetchMercado(allMarketIds)
      writeMercadoSessionCache(marketQueryKey, payload)
      return payload
    },
    staleTime: 90_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: true,
    gcTime: 180_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(12_000, 1_500 * 2 ** attempt),
    placeholderData: () => readMercadoSessionCache(marketQueryKey),
  })

  useEffect(() => {
    if (!data || isFetching) return
    const hasPrice =
      data.highlightCoins.some((c) => c?.price != null) || data.top10.some((c) => c.price != null)
    if (!hasPrice) {
      const t = window.setTimeout(() => void refetch(), 2_500)
      return () => window.clearTimeout(t)
    }
  }, [data, isFetching, refetch])

  useEffect(() => {
    if (!data) return
    const need = highlightIds.filter((id, i) =>
      highlightNeedsIconFetch(id, data.highlightCoins[i] ?? null),
    )
    const key = need.slice().sort().join(',')
    if (!key || iconsFetchedFor.current === key) return
    iconsFetchedFor.current = key
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/coingecko/coin-icons?ids=${encodeURIComponent(key)}`)
        if (!res.ok || cancelled) return
        const j = (await res.json()) as { icons?: Record<string, string> }
        let wrote = false
        for (const [id, url] of Object.entries(j.icons ?? {})) {
          writeHighlightIconUrl(id, url)
          wrote = true
        }
        if (wrote && !cancelled) setIconRefresh((n) => n + 1)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, highlightIds])

  const coinById = useMemo(() => {
    const map = new Map<string, MercadoCoin | null>()
    if (!data) return map
    allMarketIds.forEach((id, i) => {
      map.set(id, data.highlightCoins[i] ?? null)
    })
    return map
  }, [data, allMarketIds])

  const marketLoading = isLoading && !data

  const handleFavoritesSaved = useCallback((ids: string[], prefs: MercadoDisplayPrefs) => {
    writeStoredHighlightIds(ids)
    setHighlightIds(ids)
    writeMercadoDisplayPrefs(prefs)
    setDisplayPrefs(prefs)
  }, [])

  const setCoinFiat = useCallback((coinId: string, mode: MercadoDisplayFiat | 'default') => {
    const id = coinId.trim().toLowerCase()
    setDisplayPrefs((prev) => {
      const nextMap = { ...prev.displayFiatByCoinId }
      if (mode === 'default') delete nextMap[id]
      else nextMap[id] = mode
      const next = { ...prev, displayFiatByCoinId: nextMap }
      writeMercadoDisplayPrefs(next)
      return next
    })
  }, [])

  const highlightSlotIds = highlightIds
  const highlightCoins = highlightIds.map((id) => coinById.get(id) ?? null)

  const pinnedSet = useMemo(() => new Set(pinnedStockIds), [pinnedStockIds])

  const { cryptoHighlightSlots, extraStockHighlightSlots } = useMemo(() => {
    const crypto: { id: string; coin: MercadoCoin | null | undefined; index: number }[] = []
    const stock: { id: string; coin: MercadoCoin | null | undefined; index: number }[] = []
    highlightSlotIds.forEach((id, index) => {
      const slot = { id, coin: highlightCoins[index], index }
      if (isUsEquityXstock(id)) {
        if (!pinnedSet.has(id)) stock.push(slot)
      } else {
        crypto.push(slot)
      }
    })
    return { cryptoHighlightSlots: crypto, extraStockHighlightSlots: stock }
  }, [highlightSlotIds, highlightCoins, pinnedSet])

  const displayFiatLive = displayPrefs.displayFiat
  const fiatLabel = FIAT_OPTIONS.find((x) => x.id === displayFiatLive)?.label ?? displayFiatLive.toUpperCase()
  const hasPerCoinFiat = Object.keys(displayPrefs.displayFiatByCoinId).length > 0
  const mercadoNotice = useMemo(() => sanitizeMercadoErro(data?.erro ?? null), [data?.erro])
  void iconRefresh

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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-9 w-9 rounded-full border border-border/60 bg-background/90 shadow-sm backdrop-blur-sm',
                'hover:bg-muted/80 hover:border-yellow-500/40',
              )}
              title="Adicionar favoritos"
              aria-label="Adicionar moeda ou ação aos favoritos"
              onClick={() => setFavSheetOpen(true)}
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
            </Button>
            <MercadoFavoritesSheet
              open={favSheetOpen}
              onOpenChange={setFavSheetOpen}
              favoriteIds={highlightIds}
              displayPrefs={displayPrefs}
              onSaved={handleFavoritesSaved}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Preços CoinGecko · padrão em <span className="font-medium text-foreground">{fiatLabel}</span>.{' '}
            <span className="text-foreground/90">Engrenagem em cada cartão</span> muda real, dólar ou euro.{' '}
            <button
              type="button"
              className="font-medium text-yellow-500 hover:underline"
              onClick={() => setFavSheetOpen(true)}
            >
              Editar favoritos
            </button>
            {hasPerCoinFiat ? <> · alguns cartões com moeda própria.</> : null}
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

      {mercadoNotice && (
        <p className="text-[11px] leading-relaxed text-muted-foreground/75" role="status">
          {mercadoNotice}
        </p>
      )}

      {isError && error && (
        <div className="rounded-xl border border-red-500/25 bg-red-950/20 px-4 py-3 text-sm text-red-200/90">
          Não foi possível carregar o mercado. Tenta actualizar dentro de um minuto.
        </div>
      )}

      {marketLoading && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0">
            {Array.from({ length: Math.min(MAX_MARKET_HIGHLIGHTS, Math.max(4, highlightIds.length)) }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
          <SectionSkeleton />
        </div>
      )}

      {data && (
        <>
          {cryptoHighlightSlots.length > 0 && (
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Coins className="h-4 w-4 text-cyan-500/80" />
                Os teus favoritos (cripto)
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0">
                {cryptoHighlightSlots.map(({ id, coin, index }) => {
                  const displayCoin = coinForHighlightDisplay(coin ?? null, id, displayPrefs)
                  if (displayCoin) {
                    return (
                      <HighlightCard
                        key={`crypto-${displayCoin.id}-${index}`}
                        coin={displayCoin}
                        mercadoPrefs={displayPrefs}
                        onFiatChange={setCoinFiat}
                      />
                    )
                  }
                  return (
                    <HighlightEmptyCard
                      key={`empty-crypto-${id || index}`}
                      id={id}
                      mercadoPrefs={displayPrefs}
                      onFiatChange={setCoinFiat}
                    />
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-400/95">
              <Building2 className="h-4 w-4" />
              Ações americanas em destaque
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              NVIDIA, Nasdaq, Microsoft e outras referências US (tokenizadas xStock · CoinGecko).
            </p>
            {marketLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 [&>*]:min-w-0">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={`pin-sk-${i}`} className="h-44 rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 [&>*]:min-w-0">
                {pinnedStockIds.map((id) => {
                  const coin = coinById.get(id)
                  const displayCoin = coinForHighlightDisplay(coin ?? null, id, displayPrefs)
                  if (displayCoin) {
                    return (
                      <HighlightCard
                        key={`pinned-${displayCoin.id}`}
                        coin={displayCoin}
                        mercadoPrefs={displayPrefs}
                        stock
                        onFiatChange={setCoinFiat}
                      />
                    )
                  }
                  return (
                    <HighlightEmptyCard
                      key={`pinned-empty-${id}`}
                      id={id}
                      mercadoPrefs={displayPrefs}
                      onFiatChange={setCoinFiat}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {extraStockHighlightSlots.length > 0 && (
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Building2 className="h-4 w-4 text-blue-500/80" />
                Mais ações nos teus destaques
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0">
                {extraStockHighlightSlots.map(({ id, coin, index }) => {
                  const displayCoin = coinForHighlightDisplay(coin ?? null, id, displayPrefs)
                  if (displayCoin) {
                    return (
                      <HighlightCard
                        key={`stock-${displayCoin.id}-${index}`}
                        coin={displayCoin}
                        mercadoPrefs={displayPrefs}
                        stock
                        onFiatChange={setCoinFiat}
                      />
                    )
                  }
                  return (
                    <HighlightEmptyCard
                      key={`empty-stock-${id || index}`}
                      id={id}
                      mercadoPrefs={displayPrefs}
                      onFiatChange={setCoinFiat}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {data.top10.length > 0 && (
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Coins className="h-4 w-4 text-cyan-500/80" />
                Top 10 por capitalização
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {data.top10.map((c) => (
                  <CoinRowCard key={c.id} coin={c} compact mercadoPrefs={displayPrefs} />
                ))}
              </div>
            </div>
          )}

          {data.trending.length > 0 && (
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-amber-500/80" />
                Em tendência (CoinGecko)
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {data.trending.map((c) => (
                  <CoinRowCard key={`t-${c.id}-${c.symbol}`} coin={c} compact mercadoPrefs={displayPrefs} />
                ))}
              </div>
            </div>
          )}

          {(data.trendingStocks ?? []).length > 0 && (
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Building2 className="h-4 w-4 text-blue-500/80" />
                Em tendência (bolsa US)
              </h3>
              <p className="-mt-2 mb-3 text-xs text-muted-foreground">
                Maior volume e movimentos do dia — tecnologia e blue chips (FMP ou xStock).
              </p>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {(data.trendingStocks ?? []).map((r) => (
                  <StockTrendRowCard key={`st-${r.symbol}`} row={r} />
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-[11px] text-muted-foreground/70">
            Fonte: CoinGecko
            {(data.trendingStocks ?? []).length > 0 ? ' · ações US (FMP/xStock)' : ''} ·{' '}
            <span className="tabular-nums">{data.fonte}</span> · última resposta{' '}
            {data.cachedAt ? new Date(data.cachedAt).toLocaleString('pt-PT') : '—'}
          </p>
        </>
      )}
    </section>
  )
}
