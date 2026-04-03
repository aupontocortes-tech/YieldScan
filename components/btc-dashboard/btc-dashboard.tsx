'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AdvancedMetricsPanel } from '@/components/btc-dashboard/advanced-metrics-panel'
import { BtcChartsSuite } from '@/components/btc-dashboard/btc-charts-suite'
import { IndicatorsPanel } from '@/components/btc-dashboard/indicators-panel'
import { MarketCard } from '@/components/btc-dashboard/market-card'
import { SettingsPanel } from '@/components/btc-dashboard/settings-panel'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchBtcKlines } from '@/lib/btc/binance'
import { runSignalEngine } from '@/lib/btc/signal-engine'
import { kvGetJson, kvSetJson, openYieldscanSqlite } from '@/lib/client-db/sqlite-core'
import { TIMEFRAME_PRESETS, type TimeframePreset } from '@/lib/btc/types'
import { cn } from '@/lib/utils'
import { BarChart2, ChevronDown, RefreshCw, Settings2, Star } from 'lucide-react'

const DEFAULT_PINNED = ['1h', '4h', '1d', '1w', '1M']

const PINNED_KV = 'btc_pinned_tf_v1' as const

const TF_GROUPS: { label: string; presets: TimeframePreset[] }[] = [
  { label: 'Intraday',            presets: TIMEFRAME_PRESETS.filter((t) => t.group === 'intra') },
  { label: 'Diário / Semanal',   presets: TIMEFRAME_PRESETS.filter((t) => t.group === 'swing') },
  { label: 'Períodos',           presets: TIMEFRAME_PRESETS.filter((t) => t.group === 'periodo') },
]

export function BtcDashboard() {
  const { timeframe, setTimeframe, rsi, bollinger } = useBtcSettings()
  const [pinned, setPinned] = useState<string[]>(DEFAULT_PINNED)
  const [pinsHydrated, setPinsHydrated] = useState(false)
  const [editing, setEditing] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  useEffect(() => {
    let cancel = false
    void openYieldscanSqlite().then(() => {
      if (cancel) return
      const raw = kvGetJson<string[]>(PINNED_KV)
      if (Array.isArray(raw) && raw.length >= 1) {
        const valid = raw.filter((id) => TIMEFRAME_PRESETS.some((t) => t.id === id))
        if (valid.length >= 1) setPinned(valid)
      }
      setPinsHydrated(true)
    })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!pinsHydrated) return
    kvSetJson(PINNED_KV, pinned)
  }, [pinned, pinsHydrated])

  const pinnedPresets = TIMEFRAME_PRESETS.filter((t) => pinned.includes(t.id))
  const activeInPinned = pinnedPresets.some((t) => t.id === timeframe.id)

  function togglePin(id: string) {
    setPinned((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((i) => i !== id)
          : prev
        : [...prev, id]
    )
  }

  function pickTimeframe(x: TimeframePreset) {
    setTimeframe(x)
    if (!editing) setPopoverOpen(false)
  }

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

          {/* Middle: timeframes – pinned favourites + "Mais" popover */}
          <div className="flex items-center gap-0.5 rounded-lg border border-[#d4af37]/20 bg-black/60 p-0.5">
            {/* Pinned quick buttons */}
            {pinnedPresets.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => pickTimeframe(x)}
                className={cn(
                  'rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
                  timeframe.id === x.id
                    ? 'bg-[#d4af37] text-black'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                )}
              >
                {x.label}
              </button>
            ))}

            {/* If the active preset is not pinned, show it as a ghost pill */}
            {!activeInPinned && (
              <button
                type="button"
                onClick={() => setPopoverOpen(true)}
                className="rounded-md bg-[#d4af37] px-2 py-1.5 text-[11px] font-medium text-black"
              >
                {timeframe.label}
              </button>
            )}

            {/* Separator */}
            <span className="mx-0.5 h-4 w-px shrink-0 bg-zinc-700" aria-hidden />

            {/* Mais button */}
            <Popover open={popoverOpen} onOpenChange={(o) => { setPopoverOpen(o); if (!o) setEditing(false) }}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-0.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
                    popoverOpen
                      ? 'bg-zinc-800 text-[#d4af37]'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  )}
                >
                  Mais <ChevronDown className={cn('h-3 w-3 transition-transform', popoverOpen && 'rotate-180')} />
                </button>
              </PopoverTrigger>

              <PopoverContent
                align="center"
                sideOffset={6}
                className="w-72 border-[#d4af37]/20 bg-[#0d0d0d] p-0 shadow-xl shadow-black/60"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
                  <span className="text-sm font-semibold text-white">Intervalos</span>
                  <button
                    type="button"
                    onClick={() => setEditing((e) => !e)}
                    className={cn(
                      'text-xs font-medium transition-colors',
                      editing ? 'text-[#d4af37]' : 'text-zinc-400 hover:text-white'
                    )}
                  >
                    {editing ? 'Concluir' : 'Editar'}
                  </button>
                </div>

                {/* Groups */}
                <div className="space-y-3 p-4">
                  {TF_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                        {group.label}
                      </p>
                      <div className="grid grid-cols-4 gap-1">
                        {group.presets.map((x) => {
                          const isPinned = pinned.includes(x.id)
                          const isActive = timeframe.id === x.id
                          return (
                            <button
                              key={x.id}
                              type="button"
                              onClick={() => editing ? togglePin(x.id) : pickTimeframe(x)}
                              className={cn(
                                'relative flex items-center justify-center rounded-lg py-2 text-[11px] font-medium transition-all',
                                isActive && !editing
                                  ? 'bg-[#d4af37] text-black'
                                  : isPinned && editing
                                    ? 'border border-[#d4af37]/60 bg-[#d4af37]/10 text-[#d4af37]'
                                    : 'border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800'
                              )}
                            >
                              {editing && (
                                <Star
                                  className={cn(
                                    'absolute right-1 top-1 h-2.5 w-2.5 transition-colors',
                                    isPinned ? 'fill-[#d4af37] text-[#d4af37]' : 'text-zinc-700'
                                  )}
                                />
                              )}
                              {x.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer hint */}
                <div className="border-t border-zinc-800 px-4 py-2.5">
                  <p className="text-[10px] text-zinc-600">
                    {editing
                      ? 'Toca numa estrela ★ para fixar/desafixar da barra rápida.'
                      : 'Toca em "Editar" para escolher os teus intervalos favoritos.'}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
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
