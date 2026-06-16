'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp } from 'lucide-react'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import { HubPanel } from '@/components/dashboard/hub/hub-panel'
import type { MarketApiPayload, MercadoCoin } from '@/lib/coingecko-market'
import { fxRatesFromPayload } from '@/lib/coingecko-market'
import { fetchMercadoClient } from '@/lib/fetch-mercado-client'
import { COINGECKO_LOGO_BY_ID } from '@/lib/coingecko-static-logos'
import {
  effectiveDisplayFiatForCoin,
  formatMercadoFiatAmount,
  readMercadoDisplayPrefs,
  resolveMercadoDisplay,
  type MercadoDisplayPrefs,
} from '@/lib/mercado-display-prefs'
import { isUsEquityXstock } from '@/lib/us-equities'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'

const HUB_MARKET_IDS = [
  'bitcoin',
  'ethereum',
  'solana',
  'binancecoin',
  'tether',
  'nvidia-xstock',
] as const

async function fetchHubMarket(): Promise<MarketApiPayload> {
  return fetchMercadoClient([...HUB_MARKET_IDS], 'highlights')
}

function MarketTile({
  coin,
  prefs,
  fxRates,
}: {
  coin: MercadoCoin
  prefs: MercadoDisplayPrefs
  fxRates?: ReturnType<typeof fxRatesFromPayload>
}) {
  const fiat = effectiveDisplayFiatForCoin(coin.id, prefs)
  const view = resolveMercadoDisplay(coin, fiat, prefs.priceOverrides, fxRates)
  const ch = view.change_24h
  const up = ch != null && ch >= 0
  const isStock = isUsEquityXstock(coin.id)
  const href = isStock ? '/news/mercado' : `/token/${encodeURIComponent(coin.symbol.toUpperCase())}`

  return (
    <Link
      href={href}
      className={cn(
        'group/tile relative flex min-w-[9rem] flex-1 flex-col gap-2.5 overflow-hidden rounded-xl',
        'border border-white/[0.06] bg-background/50 px-3.5 py-3.5',
        'transition-all duration-300 hover:border-amber-500/25 hover:bg-amber-500/[0.04]',
        'hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.7)]',
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent opacity-0 transition-opacity group-hover/tile:opacity-100"
        aria-hidden
      />
      <div className="flex items-center gap-2.5">
        <TokenSymbolAvatar
          symbol={coin.symbol}
          coingeckoId={coin.id}
          iconUrl={COINGECKO_LOGO_BY_ID[coin.id] ?? coin.image}
          size={30}
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-bold tracking-tight text-foreground">
            {coin.symbol.toUpperCase()}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">{coin.name}</p>
        </div>
      </div>
      <div>
        <p className="font-mono text-[15px] font-semibold tabular-nums tracking-tight text-foreground">
          {formatMercadoFiatAmount(view.price, fiat)}
        </p>
        {ch != null && Number.isFinite(ch) ? (
          <p
            className={cn(
              'mt-0.5 font-mono text-[11px] font-medium tabular-nums',
              up ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {up ? '+' : ''}
            {ch.toFixed(2)}%
            <span className="ml-1 font-normal text-muted-foreground/70">24h</span>
          </p>
        ) : (
          <p className="mt-0.5 text-[11px] text-muted-foreground">— 24h</p>
        )}
      </div>
    </Link>
  )
}

export function HubMarketStrip() {
  const prefs = readMercadoDisplayPrefs()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['hub-market', HUB_MARKET_IDS.join(',')],
    queryFn: fetchHubMarket,
    staleTime: 300_000,
    refetchInterval: false as const,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
    retry: 3,
    retryDelay: (attempt) => Math.min(10_000, 1_500 * 2 ** attempt),
  })

  const fxRates = useMemo(() => fxRatesFromPayload(data), [data])

  const coins = useMemo(() => {
    if (!data?.highlightCoins) return []
    return data.highlightCoins.filter((c): c is MercadoCoin => c != null && c.price != null)
  }, [data])

  return (
    <HubPanel
      title="Preços de mercado"
      subtitle="Cripto e destaques · actualização ao vivo"
      icon={TrendingUp}
      accent="amber"
      href="/news/mercado"
      linkLabel="Mercado completo"
    >
      {isLoading && (
        <div className="flex gap-2.5 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[5.75rem] min-w-[9rem] flex-1 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (isError || coins.length === 0) && (
        <p className="py-2 text-xs text-muted-foreground">
          {isError ? 'Não foi possível carregar preços.' : 'Sem cotações no momento.'}
        </p>
      )}

      {!isLoading && coins.length > 0 && (
        <div className="-mx-0.5 flex gap-2.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          {coins.map((coin) => (
            <MarketTile key={coin.id} coin={coin} prefs={prefs} fxRates={fxRates} />
          ))}
        </div>
      )}
    </HubPanel>
  )
}
