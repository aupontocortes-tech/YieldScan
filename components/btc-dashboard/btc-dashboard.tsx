'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BtcChartsSuite } from '@/components/btc-dashboard/btc-charts-suite'
import { MarketCard } from '@/components/btc-dashboard/market-card'
import { SettingsPanel } from '@/components/btc-dashboard/settings-panel'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { fetchBtcKlines } from '@/lib/btc/binance'
import {
  INDICATOR_TOOLBAR_TIMEFRAMES,
  TIMEFRAME_PRESETS,
  TIMEFRAME_TOOLTIP_PT,
  type TimeframePreset,
} from '@/lib/btc/types'
import { runSignalEngine } from '@/lib/btc/signal-engine'
import { cn } from '@/lib/utils'
import { LayoutGrid, RefreshCw, RotateCcw, SlidersHorizontal } from 'lucide-react'

const TF_PRESETS: TimeframePreset[] = INDICATOR_TOOLBAR_TIMEFRAMES.map((id) =>
  TIMEFRAME_PRESETS.find((t) => t.id === id),
).filter((x): x is TimeframePreset => x != null)

export function BtcDashboard() {
  const { timeframe, setTimeframe, rsi, bollinger, resetDefaults } = useBtcSettings()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [chartResetKey, setChartResetKey] = useState(0)

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('painel')
      if (p === '1' || p === 'aberto') setDrawerOpen(true)
    } catch {
      /* ignore */
    }
  }, [])

  const { data: bars = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['btc-klines', timeframe.id],
    queryFn: () => fetchBtcKlines(timeframe.interval, timeframe.limit),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const signalResult = useMemo(() => {
    if (bars.length < 30) return null
    return runSignalEngine({
      closes: bars.map((b) => b.close),
      highs: bars.map((b) => b.high),
      lows: bars.map((b) => b.low),
      volumes: bars.map((b) => b.volume),
      rsiSettings: { ...rsi, enabled: true },
      bollinger: { ...bollinger, enabled: true },
    })
  }, [bars, rsi, bollinger])

  const resetLayout = () => {
    setChartResetKey((k) => k + 1)
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-[#050505] text-zinc-100">
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] gap-x-2 gap-y-1.5 border-b border-white/[0.06] px-2 py-1.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-rows-1 sm:items-center sm:gap-x-2 sm:px-3 sm:py-2">
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 sm:col-start-1 sm:row-start-1">
          <LayoutGrid className="h-4 w-4 shrink-0 text-[#d4af37]/90" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">BTC / USDT</p>
            <p className="text-[10px] text-zinc-500">Binance · CoinGecko</p>
          </div>
        </div>

        <div className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-0.5 sm:col-start-3 sm:row-start-1 sm:gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-[11px] text-zinc-400 hover:bg-white/5 hover:text-[#d4af37] sm:px-3"
            onClick={() => setDrawerOpen(true)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Indicadores</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-[11px] text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
            onClick={resetLayout}
            title="Reajusta zoom dos gráficos"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Layout</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:bg-white/5 hover:text-[#d4af37]"
            disabled={isFetching}
            onClick={() => void refetch()}
            title="Atualizar dados"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="hidden h-8 text-[11px] text-zinc-600 hover:text-zinc-300 md:inline-flex"
            onClick={resetDefaults}
          >
            Repor tudo
          </Button>
        </div>

        <nav
          aria-label="Intervalo das velas"
          className="col-span-2 row-start-2 -mx-0.5 flex min-h-[36px] min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-lg border border-white/[0.06] bg-black/40 px-0.5 py-0.5 [scrollbar-width:thin] sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:mx-0"
        >
          {TF_PRESETS.map((tf) => (
            <button
              key={tf.id}
              type="button"
              title={TIMEFRAME_TOOLTIP_PT[tf.id] ?? tf.label}
              onClick={() => setTimeframe(tf)}
              className={cn(
                'shrink-0 rounded-md px-2 py-1.5 font-mono text-[11px] font-medium tabular-nums tracking-tight transition-colors',
                timeframe.id === tf.id
                  ? 'bg-[#d4af37] text-black'
                  : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200',
              )}
            >
              {tf.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="shrink-0 border-b border-white/[0.04] px-2 py-1.5 sm:px-3 sm:py-2">
        <MarketCard bars={bars} signal={signalResult} variant="strip" />
      </div>

      <div className="flex min-h-0 min-h-[240px] flex-1 flex-col overflow-hidden p-1.5 sm:p-2 md:p-3">
        {isError && (
          <div className="mb-2 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-200">
            Não foi possível carregar as velas. Tenta outro intervalo ou atualiza.
            {error instanceof Error && error.message ? (
              <span className="mt-1 block text-xs text-red-300/80">{error.message}</span>
            ) : null}
          </div>
        )}

        {isLoading && (
          <div className="flex min-h-[40vh] flex-1 items-center justify-center rounded-lg border border-white/[0.06] bg-[#050505] text-sm text-zinc-500">
            A carregar BTC/USDT…
          </div>
        )}

        {!isLoading && !isError && (
          <div className="flex min-h-0 flex-1 flex-col">
            <BtcChartsSuite bars={bars} resetKey={chartResetKey} />
          </div>
        )}
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen} modal>
        <SheetContent
          side="right"
          className="z-[100] flex w-full flex-col border-white/[0.06] bg-[#050505] p-0 sm:max-w-lg"
        >
          <SheetHeader className="shrink-0 space-y-1 border-b border-white/[0.06] px-4 py-3 text-left">
            <SheetTitle className="text-base text-white">Indicadores &amp; aparência</SheetTitle>
            <SheetDescription className="text-[11px] leading-relaxed text-zinc-500">
              Liga só o que precisares. Velas, médias, osciladores e proxies on-chain. Preferências ficam gravadas neste
              dispositivo (SQLite + localStorage).
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-12">
            <SettingsPanel embedded />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
