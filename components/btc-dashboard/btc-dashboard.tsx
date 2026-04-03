'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AdvancedMetricsPanel } from '@/components/btc-dashboard/advanced-metrics-panel'
import { BtcChartsSuite } from '@/components/btc-dashboard/btc-charts-suite'
import { IndicatorsPanel } from '@/components/btc-dashboard/indicators-panel'
import { MarketCard } from '@/components/btc-dashboard/market-card'
import { SettingsPanel } from '@/components/btc-dashboard/settings-panel'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchBtcKlines } from '@/lib/btc/binance'
import { runSignalEngine } from '@/lib/btc/signal-engine'
import { BINANCE_INTERVALS } from '@/lib/btc/types'
import { cn } from '@/lib/utils'
import { BarChart2, RefreshCw, Settings2 } from 'lucide-react'

export function BtcDashboard() {
  const { timeframe, setTimeframe, rsi, bollinger } = useBtcSettings()

  const { data: bars = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['btc-klines', timeframe],
    queryFn: () => fetchBtcKlines(timeframe, 500),
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
      rsiSettings: rsi,
      bollinger,
    })
  }, [bars, rsi, bollinger])

  const alerts = signalResult?.alerts ?? []

  return (
    <div className="min-h-0 flex-1 bg-[#030303] text-zinc-100">
      <Tabs defaultValue="painel" className="flex h-full flex-col">
        {/* ── Top bar ──────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d4af37]/15 bg-[#050505] px-4 py-2.5">
          {/* Left: logo + title */}
          <div className="flex items-center gap-2.5">
            <BarChart2 className="h-4 w-4 text-[#d4af37]" />
            <span className="text-sm font-bold text-white">
              Bitcoin <span className="text-[#d4af37]">Analysis</span>
            </span>
            <span className="hidden text-[10px] text-zinc-600 sm:block">
              · Binance · CoinGecko · indicadores no browser
            </span>
          </div>

          {/* Middle: timeframes */}
          <div className="flex flex-wrap gap-0.5 rounded-lg border border-[#d4af37]/20 bg-black/60 p-0.5">
            {BINANCE_INTERVALS.map((x) => (
              <button
                key={x.value}
                type="button"
                onClick={() => setTimeframe(x.value)}
                className={cn(
                  'rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
                  timeframe === x.value
                    ? 'bg-[#d4af37] text-black'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                )}
              >
                {x.label}
              </button>
            ))}
          </div>

          {/* Right: refresh + tabs */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-[#d4af37]"
              disabled={isFetching}
              onClick={() => void refetch()}
              title="Actualizar dados"
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            </Button>

            <TabsList className="h-8 gap-0.5 border border-[#d4af37]/20 bg-black/60 p-0.5">
              <TabsTrigger
                value="painel"
                className="h-7 gap-1.5 rounded-md px-3 text-[11px] data-[state=active]:bg-[#d4af37] data-[state=active]:text-black data-[state=active]:shadow-none"
              >
                <BarChart2 className="h-3 w-3" /> Painel
              </TabsTrigger>
              <TabsTrigger
                value="configuracoes"
                className="h-7 gap-1.5 rounded-md px-3 text-[11px] data-[state=active]:bg-[#d4af37] data-[state=active]:text-black data-[state=active]:shadow-none"
              >
                <Settings2 className="h-3 w-3" /> Configurações
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* ── Painel ──────────────────────────────────────────── */}
        <TabsContent value="painel" className="m-0 min-h-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-[1600px] space-y-4 p-4 pb-20 md:p-6">
            {isError && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                <p>Não foi possível carregar os dados. Tenta actualizar ou mudar o timeframe.</p>
                {error instanceof Error && error.message ? (
                  <p className="mt-1 text-xs text-red-300/70">{error.message}</p>
                ) : null}
              </div>
            )}

            {isLoading && (
              <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-[#d4af37]/15 bg-black/60 text-sm text-zinc-500">
                A carregar BTC/USDT…
              </div>
            )}

            {!isLoading && !isError && (
              <>
                <MarketCard bars={bars} signal={signalResult} />

                {alerts.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Alertas</p>
                    <div className="flex flex-wrap gap-2">
                      {alerts.map((a, idx) => (
                        <div
                          key={`${idx}-${a.type}`}
                          className={cn(
                            'rounded-lg border px-3 py-2 text-xs font-medium',
                            a.type === 'bottom' && 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200',
                            a.type === 'top' && 'border-amber-500/40 bg-amber-950/40 text-amber-200',
                            a.type === 'whale' && 'border-cyan-500/35 bg-cyan-950/30 text-cyan-100',
                            a.type === 'bollinger' && 'border-violet-500/35 bg-violet-950/30 text-violet-100'
                          )}
                        >
                          {a.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <BtcChartsSuite bars={bars} />
                <IndicatorsPanel bars={bars} />
                <AdvancedMetricsPanel bars={bars} />
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Configurações ────────────────────────────────────── */}
        <TabsContent value="configuracoes" className="m-0 min-h-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-2xl p-4 pb-20 md:p-6">
            <SettingsPanel />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
