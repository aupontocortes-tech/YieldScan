'use client'

import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { MercadoCoin, MarketApiPayload } from '@/lib/coingecko-market'
import { COINGECKO_LOGO_BY_ID } from '@/lib/coingecko-static-logos'
import { cn } from '@/lib/utils'
import { Coins, ExternalLink, LineChart, RefreshCw, TrendingUp } from 'lucide-react'

async function fetchMercado(): Promise<MarketApiPayload> {
  const res = await fetch('/api/market')
  const json = (await res.json()) as MarketApiPayload
  return json
}

function formatUSD(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n < 1 && n > 0 ? 6 : n < 100 ? 4 : 2,
  }).format(n)
}

function formatCap(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)} B$`
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} Md$`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} M$`
  return `${(n / 1e3).toFixed(1)} k$`
}

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
  if (coin.id === 'hyperliquid') {
    return COINGECKO_LOGO_BY_ID.hyperliquid ?? coin.image
  }
  return coin.image
}

function CoinThumb({ coin, size = 40 }: { coin: MercadoCoin; size?: number }) {
  const src = coinThumbSrc(coin)
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="rounded-full bg-muted/40 object-cover"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    )
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground"
      style={{ width: size, height: size }}
    >
      <Coins className="h-1/2 w-1/2 opacity-60" />
    </div>
  )
}

function CoinRowCard({ coin, compact }: { coin: MercadoCoin; compact?: boolean }) {
  const href = `https://www.coingecko.com/en/coins/${encodeURIComponent(coin.id)}`
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
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-foreground">{coin.name}</span>
          <span className="shrink-0 text-[10px] uppercase text-muted-foreground">{coin.symbol}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold tabular-nums text-foreground">{formatUSD(coin.price)}</span>
          <Variacao value={coin.change_24h} />
        </div>
        {!compact && coin.market_cap != null && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">Cap. mercado {formatCap(coin.market_cap)}</p>
        )}
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
    </a>
  )
}

function HighlightCard({ coin, label }: { coin: MercadoCoin; label: string }) {
  const href = `https://www.coingecko.com/en/coins/${encodeURIComponent(coin.id)}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/40 via-card/90 to-background p-5 transition-all hover:border-cyan-500/45 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-cyan-400/90">{label}</p>
          <h3 className="mt-1 text-lg font-bold text-foreground">{coin.name}</h3>
          <p className="text-xs text-muted-foreground">{coin.symbol}</p>
        </div>
        <CoinThumb coin={coin} size={52} />
      </div>
      <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-foreground">{formatUSD(coin.price)}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">24h</span>
        <Variacao value={coin.change_24h} />
      </div>
      {coin.market_cap != null && (
        <p className="mt-3 text-[11px] text-muted-foreground">Capitalização · {formatCap(coin.market_cap)}</p>
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

export function DashbuddyCryptoMarket() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['crypto-market'],
    queryFn: fetchMercado,
    staleTime: 55_000,
    gcTime: 120_000,
    retry: 1,
  })

  const btc = data?.highlights.bitcoin ?? null
  const eth = data?.highlights.ethereum ?? null
  const sol = data?.highlights.solana ?? null
  const hype = data?.highlights.hyperliquid ?? null

  return (
    <section className="space-y-8" aria-labelledby="mercado-cripto-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <LineChart className="h-5 w-5 text-cyan-400" />
            <h2 id="mercado-cripto-heading" className="text-2xl font-bold tracking-tight">
              Mercado
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Preços e tendências via API pública CoinGecko (USD). Actualização em cache ~60s para respeitar limites
            de pedidos.
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
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
              Bitcoin, Ethereum, Solana e Hyperliquid
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {btc ? (
                <HighlightCard coin={btc} label="Bitcoin" />
              ) : (
                <div className="rounded-2xl border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
                  Bitcoin indisponível
                </div>
              )}
              {eth ? (
                <HighlightCard coin={eth} label="Ethereum" />
              ) : (
                <div className="rounded-2xl border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
                  Ethereum indisponível
                </div>
              )}
              {sol ? (
                <HighlightCard coin={sol} label="Solana" />
              ) : (
                <div className="rounded-2xl border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
                  Solana indisponível
                </div>
              )}
              {hype ? (
                <HighlightCard coin={hype} label="Hyperliquid Premium" />
              ) : (
                <div className="rounded-2xl border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
                  Hyperliquid indisponível
                </div>
              )}
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
                  <CoinRowCard key={c.id} coin={c} compact />
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
                  <CoinRowCard key={`t-${c.id}-${c.symbol}`} coin={c} compact />
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
