'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { BINANCE_INTERVALS, type MaType } from '@/lib/btc/types'
import { Trash2 } from 'lucide-react'

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
    resetDefaults,
  } = useBtcSettings()

  return (
    <ScrollArea className="h-[min(85vh,720px)] pr-3">
      <div className="space-y-6 pb-6">
        <div>
          <h4 className="text-sm font-semibold text-[#d4af37]">Timeframe global</h4>
          <p className="mt-1 text-xs text-zinc-500">Velas Binance (BTCUSDT)</p>
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as typeof timeframe)}>
            <SelectTrigger className="mt-2 h-9 w-full border-[#d4af37]/30 bg-black/60">
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
        </div>

        <Separator className="bg-[#d4af37]/20" />

        <div>
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-[#d4af37]">Moving averages</h4>
            <Button type="button" size="sm" variant="outline" className="h-8 border-[#d4af37]/40 text-xs" onClick={addMa}>
              + Adicionar
            </Button>
          </div>
          <p className="mt-1 text-xs text-zinc-500">SMA ou EMA sobre o preço de fecho. Cores no gráfico.</p>
          <div className="mt-3 space-y-3">
            {mas.map((ma) => (
              <div
                key={ma.id}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-800 bg-black/50 p-3"
              >
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-500">Período</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    className="h-8 w-20 border-zinc-700 bg-black font-mono text-xs"
                    value={ma.period}
                    onChange={(e) =>
                      updateMa(ma.id, { period: Math.min(500, Math.max(1, Number(e.target.value) || 1)) })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-500">Tipo</Label>
                  <Select
                    value={ma.type}
                    onValueChange={(v) => updateMa(ma.id, { type: v as MaType })}
                  >
                    <SelectTrigger className="h-8 w-[88px] border-zinc-700 bg-black text-xs">
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
                    className="h-8 w-12 cursor-pointer rounded border border-zinc-700 bg-black"
                    aria-label="Cor da média"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-red-400"
                  disabled={mas.length <= 1}
                  onClick={() => removeMa(ma.id)}
                  aria-label="Remover média"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-[#d4af37]/20" />

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-[#d4af37]">RSI</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-zinc-500">Período</Label>
              <Input
                type="number"
                min={2}
                max={100}
                className="h-8 border-zinc-700 bg-black font-mono text-xs"
                value={rsi.period}
                onChange={(e) => setRsi({ ...rsi, period: Math.min(100, Math.max(2, Number(e.target.value) || 14)) })}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-black/50 px-3 py-2">
              <Label htmlFor="rsi-levels" className="text-xs text-zinc-400">
                Linhas no gráfico
              </Label>
              <Switch
                id="rsi-levels"
                checked={rsi.showLevels}
                onCheckedChange={(c) => setRsi({ ...rsi, showLevels: c })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-zinc-500">Oversold</Label>
              <Input
                type="number"
                className="h-8 border-zinc-700 bg-black font-mono text-xs"
                value={rsi.oversold}
                onChange={(e) =>
                  setRsi({ ...rsi, oversold: Math.min(50, Math.max(0, Number(e.target.value) || 30)) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-zinc-500">Overbought</Label>
              <Input
                type="number"
                className="h-8 border-zinc-700 bg-black font-mono text-xs"
                value={rsi.overbought}
                onChange={(e) =>
                  setRsi({ ...rsi, overbought: Math.min(100, Math.max(50, Number(e.target.value) || 70)) })
                }
              />
            </div>
          </div>
        </div>

        <Separator className="bg-[#d4af37]/20" />

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-[#d4af37]">MACD</h4>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['fast', macd.fast, (n: number) => setMacd({ ...macd, fast: n })],
                ['slow', macd.slow, (n: number) => setMacd({ ...macd, slow: n })],
                ['signal', macd.signal, (n: number) => setMacd({ ...macd, signal: n })],
              ] as const
            ).map(([key, val, fn]) => (
              <div key={key} className="space-y-1">
                <Label className="text-[10px] capitalize text-zinc-500">{key}</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  className="h-8 border-zinc-700 bg-black font-mono text-xs"
                  value={val}
                  onChange={(e) => fn(Math.min(200, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-[#d4af37]/20" />

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-[#d4af37]">Stochastic</h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-zinc-500">%K período</Label>
              <Input
                type="number"
                min={1}
                max={100}
                className="h-8 border-zinc-700 bg-black font-mono text-xs"
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
                className="h-8 border-zinc-700 bg-black font-mono text-xs"
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
                className="h-8 border-zinc-700 bg-black font-mono text-xs"
                value={stoch.smooth}
                onChange={(e) =>
                  setStoch({ ...stoch, smooth: Math.min(20, Math.max(1, Number(e.target.value) || 3)) })
                }
              />
            </div>
          </div>
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
    </ScrollArea>
  )
}
