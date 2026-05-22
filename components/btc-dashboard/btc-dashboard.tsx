'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BtcChartsSuite } from '@/components/btc-dashboard/btc-charts-suite'
import { IndicatorPairSelector } from '@/components/btc-dashboard/indicator-pair-selector'
import { MarketCard } from '@/components/btc-dashboard/market-card'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import { evaluateGoldenCrossState } from '@/lib/btc/cycle-bottom'
import { fetchIndicatorKlines, fetchPairKlinesByInterval } from '@/lib/btc/klines-client'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  INDICATOR_TOOLBAR_LABEL_PT,
  INDICATOR_TOOLBAR_TIMEFRAMES,
  TIMEFRAME_PRESETS,
  TIMEFRAME_TOOLTIP_PT,
  type TimeframePreset,
} from '@/lib/btc/types'
import { runSignalEngine } from '@/lib/btc/signal-engine'
import { cn } from '@/lib/utils'
import { ArrowLeft, LayoutGrid, Loader2, RefreshCw, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { GoldenCrossStatus } from '@/components/btc-dashboard/golden-cross-status'

const SettingsPanelLazy = dynamic(
  () =>
    import('@/components/btc-dashboard/settings-panel').then((m) => ({
      default: m.SettingsPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center gap-2 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#d4af37]/80" aria-hidden />
        <p className="text-xs text-zinc-500">A carregar configurações…</p>
      </div>
    ),
  },
)

const TF_PRESETS: TimeframePreset[] = INDICATOR_TOOLBAR_TIMEFRAMES.map((id) =>
  TIMEFRAME_PRESETS.find((t) => t.id === id),
).filter((x): x is TimeframePreset => x != null)

export function BtcDashboard() {
  const {
    pair,
    setPair,
    timeframe,
    setTimeframe,
    rsi,
    bollinger,
    resetDefaults,
    bullMarketBand,
    sma200Daily,
    sma50Weekly,
    goldenCrossDaily,
    setGoldenCrossDaily,
  } = useBtcSettings()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [chartFocus, setChartFocus] = useState<'none' | 'goldenCross'>('none')
  const [chartResetKey, setChartResetKey] = useState(0)

  const openGoldenCrossFullscreen = () => {
    const tf = TIMEFRAME_PRESETS.find((t) => t.id === '1d')
    if (tf) setTimeframe(tf)
    setGoldenCrossDaily({ ...goldenCrossDaily, enabled: true })
    setChartFocus('goldenCross')
    setDrawerOpen(false)
  }

  const backFromChartFocus = () => {
    setChartFocus('none')
    setDrawerOpen(true)
  }

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('painel')
      if (p === '1' || p === 'aberto') setDrawerOpen(true)
    } catch {
      /* ignore */
    }
  }, [])

  const fullHistoryChart =
    timeframe.id === '1d' || timeframe.id === '1w' || timeframe.id === '1M'

  const { data: bars = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['indicator-klines', pair.id, timeframe.id],
    queryFn: () => fetchIndicatorKlines(pair, timeframe),
    staleTime: fullHistoryChart ? 300_000 : 30_000,
    refetchInterval: fullHistoryChart ? 300_000 : 60_000,
  })

  const needWeekly = bullMarketBand.enabled || sma50Weekly.enabled
  const needDailySupplement =
    (sma200Daily.enabled || goldenCrossDaily.enabled) && timeframe.interval !== '1d'

  const { data: dailyBarsSupplement = [] } = useQuery({
    queryKey: ['indicator-daily', pair.id, 'full'],
    queryFn: () => fetchPairKlinesByInterval(pair, '1d', 0),
    enabled: needDailySupplement,
    staleTime: 300_000,
  })

  const dailyBarsResolved = useMemo(() => {
    if (!sma200Daily.enabled && !goldenCrossDaily.enabled) return []
    if (timeframe.interval === '1d' && bars.length > 0) return bars
    return dailyBarsSupplement
  }, [sma200Daily.enabled, goldenCrossDaily.enabled, timeframe.interval, bars, dailyBarsSupplement])

  const dailyBarsForSma200 = useMemo(() => {
    if (!sma200Daily.enabled) return []
    return dailyBarsResolved
  }, [sma200Daily.enabled, dailyBarsResolved])

  const dailyBarsForGoldenCross = useMemo(() => {
    if (!goldenCrossDaily.enabled) return []
    return dailyBarsResolved
  }, [goldenCrossDaily.enabled, dailyBarsResolved])

  const goldenCrossState = useMemo(
    () => evaluateGoldenCrossState(dailyBarsForGoldenCross),
    [dailyBarsForGoldenCross],
  )

  const { data: weeklyBarsSupplement = [] } = useQuery({
    queryKey: ['indicator-weekly', pair.id, 'full'],
    queryFn: () => fetchPairKlinesByInterval(pair, '1w', 0),
    enabled: needWeekly && timeframe.interval !== '1w',
    staleTime: 300_000,
  })

  /** Séries semanais: no gráfico 1w reutiliza as velas já carregadas. */
  const weeklyBarsResolved = useMemo(() => {
    if (!needWeekly) return []
    if (timeframe.interval === '1w' && bars.length > 0) return bars
    return weeklyBarsSupplement
  }, [needWeekly, timeframe.interval, bars, weeklyBarsSupplement])

  const weeklyBarsForBandResolved = useMemo(() => {
    if (!bullMarketBand.enabled) return []
    return weeklyBarsResolved
  }, [bullMarketBand.enabled, weeklyBarsResolved])

  const weeklyBarsForSma50Resolved = useMemo(() => {
    if (!sma50Weekly.enabled) return []
    return weeklyBarsResolved
  }, [sma50Weekly.enabled, weeklyBarsResolved])

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

  const chartSuite = (
    <BtcChartsSuite
      bars={bars}
      dailyBarsForSma200={dailyBarsForSma200}
      dailyBarsForGoldenCross={dailyBarsForGoldenCross}
      sma200Loading={
        sma200Daily.enabled &&
        dailyBarsForSma200.length < 200 &&
        (timeframe.interval !== '1d' || bars.length < 200)
      }
      goldenCrossLoading={
        goldenCrossDaily.enabled &&
        dailyBarsForGoldenCross.length < 200 &&
        (timeframe.interval !== '1d' || bars.length < 200)
      }
      weeklyBarsForBand={weeklyBarsForBandResolved}
      weeklyBarsForSma50={weeklyBarsForSma50Resolved}
      bullBandLoading={
        bullMarketBand.enabled &&
        weeklyBarsForBandResolved.length < 22 &&
        (timeframe.interval !== '1w' || bars.length < 22)
      }
      sma50Loading={
        sma50Weekly.enabled &&
        weeklyBarsForSma50Resolved.length < 50 &&
        (timeframe.interval !== '1w' || bars.length < 50)
      }
      priceOnlyFocus={chartFocus === 'goldenCross'}
      resetKey={chartResetKey}
    />
  )

  if (chartFocus === 'goldenCross') {
    return (
      <div className="fixed inset-0 z-[200] flex min-h-0 flex-col bg-[#050505] text-zinc-100">
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.06] px-3 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 border-zinc-700 bg-black/60 text-xs text-zinc-200 hover:bg-white/5"
            onClick={backFromChartFocus}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar aos indicadores
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Golden Cross · Death Cross</p>
            <p className="text-[10px] text-zinc-500">
              {pair.label} · Diário · SMA 50 e SMA 200
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-zinc-400"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </header>
        <div className="shrink-0 border-b border-white/[0.04] px-3 py-2">
          <GoldenCrossStatus state={goldenCrossState} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
          {isError && (
            <div className="mb-2 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-200">
              Não foi possível carregar as velas.
            </div>
          )}
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
              A carregar {pair.label}…
            </div>
          ) : (
            chartSuite
          )}
        </div>
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen} modal>
          <SheetContent
            side="right"
            className="z-[210] flex w-full flex-col border-white/[0.06] bg-[#050505] p-0 sm:max-w-lg"
          >
            <SheetHeader className="shrink-0 space-y-1 border-b border-white/[0.06] px-4 py-3 text-left">
              <SheetTitle className="text-base text-white">Indicadores &amp; aparência</SheetTitle>
              <SheetDescription className="text-[11px] leading-relaxed text-zinc-500">
                Fundos de ciclo, Golden Cross e restantes indicadores.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-12">
              {drawerOpen ? (
                <SettingsPanelLazy
                  embedded
                  onChartViewApplied={() => setDrawerOpen(false)}
                  onGoldenCrossFullscreen={openGoldenCrossFullscreen}
                />
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-[#050505] text-zinc-100">
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] gap-x-2 gap-y-1.5 border-b border-white/[0.06] px-2 py-1.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-rows-1 sm:items-center sm:gap-x-2 sm:px-3 sm:py-2">
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 sm:col-start-1 sm:row-start-1">
          <LayoutGrid className="h-4 w-4 shrink-0 text-[#d4af37]/90" aria-hidden />
          <IndicatorPairSelector pair={pair} onSelect={setPair} />
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
              {INDICATOR_TOOLBAR_LABEL_PT[tf.id] ?? tf.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="shrink-0 border-b border-white/[0.04] px-2 py-1.5 sm:px-3 sm:py-2">
        <MarketCard bars={bars} signal={signalResult} pair={pair} variant="strip" />
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
            A carregar {pair.label}…
          </div>
        )}

        {!isLoading && !isError && <div className="flex min-h-0 flex-1 flex-col">{chartSuite}</div>}
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen} modal>
        <SheetContent
          side="right"
          className="z-[100] flex w-full flex-col border-white/[0.06] bg-[#050505] p-0 sm:max-w-lg"
        >
          <SheetHeader className="shrink-0 space-y-1 border-b border-white/[0.06] px-4 py-3 text-left">
            <SheetTitle className="text-base text-white">Indicadores &amp; aparência</SheetTitle>
            <SheetDescription className="text-[11px] leading-relaxed text-zinc-500">
              No topo: fundos de ciclo (Pompx). Depois: velas, médias, osciladores e proxies.
              Preferências gravadas neste dispositivo (SQLite + localStorage).
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-12">
            {drawerOpen ? (
              <SettingsPanelLazy
                embedded
                onChartViewApplied={() => setDrawerOpen(false)}
                onGoldenCrossFullscreen={openGoldenCrossFullscreen}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
