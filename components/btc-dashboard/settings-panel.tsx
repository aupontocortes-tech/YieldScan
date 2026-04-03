'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import { BTC_CHART_THEME } from '@/lib/btc/chart-theme'
import { BINANCE_INTERVALS, type MaType } from '@/lib/btc/types'
import { ChevronDown, HelpCircle, Trash2 } from 'lucide-react'

function ColorLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-800/80 pt-3">
      <span className="w-full text-[10px] font-medium uppercase tracking-wide text-zinc-500">Cores no gráfico</span>
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-black/50 px-2 py-1"
        >
          <span
            className="h-2.5 w-7 shrink-0 rounded-sm ring-1 ring-zinc-700"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="text-[10px] leading-tight text-zinc-400">{item.label}</span>
        </span>
      ))}
    </div>
  )
}

function WhatIsThis({ name, children }: { name: string; children: ReactNode }) {
  return (
    <Collapsible className="mt-2">
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full justify-between border-zinc-700 bg-black/40 text-[11px] text-[#d4af37] hover:bg-zinc-900 hover:text-[#e8c547] data-[state=open]:[&_.chevron-help]:rotate-180"
        >
          <span className="flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 shrink-0" />
            O que é {name}?
          </span>
          <ChevronDown className="chevron-help h-3.5 w-3.5 shrink-0 opacity-60 transition-transform" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=closed]:animate-out data-[state=open]:animate-in">
        <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/90 p-3 text-xs leading-relaxed text-zinc-400">
          {children}
        </p>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function SettingsPanel() {
  const {
    timeframe,
    setTimeframe,
    mas,
    addMa,
    updateMa,
    removeMa,
    rsi,
    setRsi,
    macd,
    setMacd,
    stoch,
    setStoch,
    bollinger,
    setBollinger,
    resetDefaults,
  } = useBtcSettings()

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h3 className="text-base font-bold tracking-tight text-white">Intervalo das velas</h3>
        <p className="mt-0.5 text-xs text-zinc-500">Timeframe Binance · BTC/USDT</p>
        <WhatIsThis name="o intervalo">
          Cada vela agrupa o preço num período (ex.: 1h = uma hora). Intervalos maiores suavizam ruído;
          menores mostram mais detalhe. O gráfico principal e os indicadores abaixo usam sempre este intervalo.
        </WhatIsThis>
        <Select value={timeframe} onValueChange={(v) => setTimeframe(v as typeof timeframe)}>
          <SelectTrigger className="mt-3 h-10 w-full border-[#d4af37]/30 bg-black/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BINANCE_INTERVALS.map((x) => (
              <SelectItem key={x.value} value={x.value}>
                {x.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ColorLegend
          items={[
            { color: BTC_CHART_THEME.gold, label: 'Vela alta / fecho ≥ abertura' },
            { color: BTC_CHART_THEME.candleDown, label: 'Vela baixa' },
          ]}
        />
      </div>

      <Separator className="bg-[#d4af37]/20" />

      <div>
        <h3 className="text-base font-bold tracking-tight text-white">Médias móveis (no preço)</h3>
        <p className="mt-0.5 text-xs text-zinc-500">SMA ou EMA — linhas sobre o gráfico de velas</p>
        <WhatIsThis name="a média móvel">
          Suaviza o preço ao longo do tempo. <strong className="text-zinc-300">SMA</strong> é a média simples;
          <strong className="text-zinc-300"> EMA</strong> dá mais peso aos preços recentes. Cruzamentos ou distância
          ao preço ajudam a ver tendência e possíveis suportes/resistências dinâmicos.
        </WhatIsThis>
        <div className="mt-3 flex items-center justify-end">
          <Button type="button" size="sm" variant="outline" className="h-8 border-[#d4af37]/40 text-xs" onClick={addMa}>
            + Adicionar média
          </Button>
        </div>
        <div className="mt-3 space-y-3">
          {mas.map((ma) => (
            <div
              key={ma.id}
              className="rounded-xl border border-zinc-800 bg-black/50 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#d4af37]">
                  MM {ma.period} · {ma.type}
                </p>
                <span
                  className="h-4 w-10 shrink-0 rounded border border-zinc-600"
                  style={{ backgroundColor: ma.color }}
                  title="Cor no gráfico"
                  aria-label={`Cor ${ma.color}`}
                />
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-500">Período</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    className="h-9 w-20 border-zinc-700 bg-black font-mono text-xs"
                    value={ma.period}
                    onChange={(e) =>
                      updateMa(ma.id, { period: Math.min(500, Math.max(1, Number(e.target.value) || 1)) })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-500">Tipo</Label>
                  <Select value={ma.type} onValueChange={(v) => updateMa(ma.id, { type: v as MaType })}>
                    <SelectTrigger className="h-9 w-[88px] border-zinc-700 bg-black text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SMA">SMA</SelectItem>
                      <SelectItem value="EMA">EMA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-500">Cor</Label>
                  <input
                    type="color"
                    value={ma.color}
                    onChange={(e) => updateMa(ma.id, { color: e.target.value })}
                    className="h-9 w-14 cursor-pointer rounded border border-zinc-700 bg-black"
                    aria-label="Cor da média no gráfico"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-zinc-500 hover:text-red-400"
                  onClick={() => removeMa(ma.id)}
                  aria-label="Remover média"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <ColorLegend items={mas.map((m) => ({ color: m.color, label: `MM ${m.period} (${m.type})` }))} />
      </div>

      <Separator className="bg-[#d4af37]/20" />

      <div>
        <h3 className="text-base font-bold tracking-tight text-white">RSI</h3>
        <p className="text-xs text-zinc-500">Relative Strength Index · momentum 0–100</p>
        <WhatIsThis name="o RSI">
          Mede se o movimento recente foi &quot;forte demais&quot; para cima ou para baixo. Valores altos sugerem
          sobrecompra; baixos, sobrevenda — muitas vezes usados com as linhas que definires (ex. 30 / 70), sem serem
          sinais garantidos.
        </WhatIsThis>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-zinc-500">Período</Label>
            <Input
              type="number"
              min={2}
              max={100}
              className="h-9 border-zinc-700 bg-black font-mono text-xs"
              value={rsi.period}
              onChange={(e) => setRsi({ ...rsi, period: Math.min(100, Math.max(2, Number(e.target.value) || 14)) })}
            />
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-black/50 px-3 py-2">
            <Label htmlFor="rsi-levels" className="text-xs text-zinc-400">
              Linhas 30/70 no gráfico
            </Label>
            <Switch id="rsi-levels" checked={rsi.showLevels} onCheckedChange={(c) => setRsi({ ...rsi, showLevels: c })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-zinc-500">Sobrevenda (oversold)</Label>
            <Input
              type="number"
              className="h-9 border-zinc-700 bg-black font-mono text-xs"
              value={rsi.oversold}
              onChange={(e) =>
                setRsi({ ...rsi, oversold: Math.min(50, Math.max(0, Number(e.target.value) || 30)) })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-zinc-500">Sobrecompra (overbought)</Label>
            <Input
              type="number"
              className="h-9 border-zinc-700 bg-black font-mono text-xs"
              value={rsi.overbought}
              onChange={(e) =>
                setRsi({ ...rsi, overbought: Math.min(100, Math.max(50, Number(e.target.value) || 70)) })
              }
            />
          </div>
        </div>
        <ColorLegend
          items={[
            { color: BTC_CHART_THEME.rsiLine, label: 'Linha RSI' },
            ...(rsi.showLevels
              ? [
                  { color: BTC_CHART_THEME.rsiOversoldLine, label: `Nível ${rsi.oversold}` },
                  { color: BTC_CHART_THEME.rsiOverboughtLine, label: `Nível ${rsi.overbought}` },
                ]
              : []),
          ]}
        />
      </div>

      <Separator className="bg-[#d4af37]/20" />

      <div>
        <h3 className="text-base font-bold tracking-tight text-white">MACD</h3>
        <p className="text-xs text-zinc-500">Moving Average Convergence Divergence</p>
        <WhatIsThis name="o MACD">
          Cruza duas médias do preço (rápida vs lenta) e compara com uma linha de sinal. O histograma mostra a
          diferença: ajuda a ver mudanças de momentum e possíveis cruzamentos de tendência.
        </WhatIsThis>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              ['Rápida', 'fast', macd.fast, (n: number) => setMacd({ ...macd, fast: n })],
              ['Lenta', 'slow', macd.slow, (n: number) => setMacd({ ...macd, slow: n })],
              ['Sinal', 'signal', macd.signal, (n: number) => setMacd({ ...macd, signal: n })],
            ] as const
          ).map(([label, key, val, fn]) => (
            <div key={key} className="space-y-1">
              <Label className="text-[10px] text-zinc-500">{label}</Label>
              <Input
                type="number"
                min={1}
                max={200}
                className="h-9 border-zinc-700 bg-black font-mono text-xs"
                value={val}
                onChange={(e) => fn(Math.min(200, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
          ))}
        </div>
        <ColorLegend
          items={[
            { color: BTC_CHART_THEME.macdHistogramPos, label: 'Histograma ≥ 0' },
            { color: BTC_CHART_THEME.macdHistogramNeg, label: 'Histograma negativo' },
            { color: BTC_CHART_THEME.macdLine, label: 'Linha MACD' },
            { color: BTC_CHART_THEME.macdSignal, label: 'Linha de sinal' },
          ]}
        />
      </div>

      <Separator className="bg-[#d4af37]/20" />

      <div>
        <h3 className="text-base font-bold tracking-tight text-white">Estocástico</h3>
        <p className="text-xs text-zinc-500">Stochastic · %K e %D</p>
        <WhatIsThis name="o estocástico">
          Compara o fecho com o intervalo high–low recente. %K reage mais depressa; %D suaviza %K. Zonas altas/baixas
          sugerem possível sobrecompra ou sobrevenda, em conjunto com o resto da análise.
        </WhatIsThis>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-zinc-500">%K período</Label>
            <Input
              type="number"
              min={1}
              max={100}
              className="h-9 border-zinc-700 bg-black font-mono text-xs"
              value={stoch.kPeriod}
              onChange={(e) =>
                setStoch({ ...stoch, kPeriod: Math.min(100, Math.max(1, Number(e.target.value) || 14)) })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-zinc-500">%D período</Label>
            <Input
              type="number"
              min={1}
              max={50}
              className="h-9 border-zinc-700 bg-black font-mono text-xs"
              value={stoch.dPeriod}
              onChange={(e) =>
                setStoch({ ...stoch, dPeriod: Math.min(50, Math.max(1, Number(e.target.value) || 3)) })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-zinc-500">Suavização</Label>
            <Input
              type="number"
              min={1}
              max={20}
              className="h-9 border-zinc-700 bg-black font-mono text-xs"
              value={stoch.smooth}
              onChange={(e) =>
                setStoch({ ...stoch, smooth: Math.min(20, Math.max(1, Number(e.target.value) || 3)) })
              }
            />
          </div>
        </div>
        <ColorLegend
          items={[
            { color: BTC_CHART_THEME.stochK, label: '%K (rápido)' },
            { color: BTC_CHART_THEME.stochD, label: '%D (suavizado)' },
          ]}
        />
      </div>

      <Separator className="bg-[#d4af37]/20" />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold tracking-tight text-white">Bandas de Bollinger</h3>
            <p className="text-xs text-zinc-500">SMA central ± desvio padrão (volatilidade)</p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="bb-on" className="text-[11px] text-zinc-400">
              Ativar
            </Label>
            <Switch
              id="bb-on"
              checked={bollinger.enabled}
              onCheckedChange={(c) => setBollinger({ ...bollinger, enabled: c })}
            />
          </div>
        </div>
        <WhatIsThis name="Bollinger">
          A linha do meio é a média móvel simples; as bandas superior e inferior afastam-se conforme a volatilidade
          recente. Preço perto da banda inferior/superior sugere extremo estatístico relativo — não é sinal mecânico.
        </WhatIsThis>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-zinc-500">Período (SMA)</Label>
            <Input
              type="number"
              min={5}
              max={200}
              className="h-9 border-zinc-700 bg-black font-mono text-xs"
              value={bollinger.period}
              onChange={(e) =>
                setBollinger({
                  ...bollinger,
                  period: Math.min(200, Math.max(5, Number(e.target.value) || 20)),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-zinc-500">Desvio padrão (σ)</Label>
            <Input
              type="number"
              min={0.5}
              max={4}
              step={0.1}
              className="h-9 border-zinc-700 bg-black font-mono text-xs"
              value={bollinger.stdDev}
              onChange={(e) =>
                setBollinger({
                  ...bollinger,
                  stdDev: Math.min(4, Math.max(0.5, Number(e.target.value) || 2)),
                })
              }
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              ['showUpper', 'Banda superior', bollinger.showUpper],
              ['showMiddle', 'Linha média', bollinger.showMiddle],
              ['showLower', 'Banda inferior', bollinger.showLower],
            ] as const
          ).map(([key, label, on]) => (
            <div key={key} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-black/50 px-3 py-2">
              <Label className="text-xs text-zinc-400">{label}</Label>
              <Switch
                checked={on}
                onCheckedChange={(c) =>
                  setBollinger((prev) => ({
                    ...prev,
                    [key]: c,
                  }))
                }
              />
            </div>
          ))}
        </div>
        <ColorLegend
          items={[
            { color: BTC_CHART_THEME.bbUpper, label: 'Superior (tracejada)' },
            { color: BTC_CHART_THEME.bbMiddle, label: 'Média' },
            { color: BTC_CHART_THEME.bbLower, label: 'Inferior (tracejada)' },
          ]}
        />
      </div>

      <Separator className="bg-[#d4af37]/20" />

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <p className="text-[11px] font-medium text-zinc-400">Indicadores nesta página</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] text-zinc-500">
          <li>Velas OHLC no painel principal</li>
          <li>Médias móveis dinâmicas (SMA/EMA), adicionar/remover à vontade</li>
          <li>RSI com níveis configuráveis</li>
          <li>MACD (linha, sinal, histograma)</li>
          <li>Estocástico (%K / %D)</li>
          <li>Bandas de Bollinger (superior, média, inferior)</li>
        </ul>
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
          Fora de âmbito (por agora): VWAP, Fibonacci, perfil de volume, Ichimoku, ordens em tempo real.
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full border-[#d4af37]/40 text-zinc-300"
        onClick={resetDefaults}
      >
        Repor predefinições
      </Button>
    </div>
  )
}
