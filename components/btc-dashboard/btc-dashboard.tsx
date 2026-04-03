'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BtcChartsSuite } from '@/components/btc-dashboard/btc-charts-suite'
import { IndicatorsPanel } from '@/components/btc-dashboard/indicators-panel'
import { MarketCard } from '@/components/btc-dashboard/market-card'
import { SettingsPanel } from '@/components/btc-dashboard/settings-panel'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { fetchBtcKlines } from '@/lib/btc/binance'
import { runSignalEngine } from '@/lib/btc/signal-engine'
import { BINANCE_INTERVALS } from '@/lib/btc/types'
import { cn } from '@/lib/utils'
import { RefreshCw, Settings2 } from 'lucide-react'

export function BtcDashboard() {
  const { timeframe, setTimeframe, rsi } = useBtcSettings()

  const { data: bars = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['btc-klines', timeframe],
    queryFn: () => fetchBtcKlines(timeframe, 500),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const alerts = useMemo(() => {
    if (bars.length < 20) return []
    const closes = bars.map((b) => b.close)
    const vols = bars.map((b) => b.volume)
    return runSignalEngine(closes, vols, rsi).alerts
  }, [bars, rsi])

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#030303] text-zinc-100">
      <div className="mx-auto max-w-[1600px] space-y-4 p-4 pb-24 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">
              Bitcoin <span className="text-[#d4af37]">Indicator</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Análise técnica · dados públicos Binance · indicadores calculados no browser
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-lg border border-[#d4af37]/25 bg-black/50 p-1">
              {BINANCE_INTERVALS.map((x) => (
                <button
                  key={x.value}
                  type="button"
                  onClick={() => setTimeframe(x.value)}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                    timeframe === x.value
                      ? 'bg-[#d4af37] text-black'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  )}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/10"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw className={cn('mr-2 h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Atualizar
            </Button>
            <Sheet modal={false}>
              <SheetTrigger asChild>
                <Button size="sm" className="bg-[#d4af37] text-black hover:bg-[#c9a227]">
                  <Settings2 className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full border-[#d4af37]/25 bg-[#0a0a0a] sm:max-w-md">
                <SheetHeader>
                  <SheetTitle className="text-[#d4af37]">Indicator settings</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <SettingsPanel />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {alerts.map((a) => (
              <div
                key={a.type + a.message}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm',
                  a.type === 'bottom'
                    ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                    : 'border-amber-500/40 bg-amber-950/40 text-amber-200'
                )}
              >
                {a.message}
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            <p>Não foi possível carregar as velas. Tenta novamente ou muda o intervalo.</p>
            {error instanceof Error && error.message ? (
              <p className="mt-2 text-xs text-red-300/80">{error.message}</p>
            ) : null}
          </div>
        )}

        {isLoading && (
          <div className="rounded-xl border border-[#d4af37]/20 bg-black/60 py-16 text-center text-zinc-500">
            A carregar BTC/USDT…
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <MarketCard bars={bars} />
            <BtcChartsSuite bars={bars} />
            <IndicatorsPanel bars={bars} />
          </>
        )}
      </div>
    </div>
  )
}
