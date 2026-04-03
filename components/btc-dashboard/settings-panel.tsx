'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import type { MaType } from '@/lib/btc/types'
import { BTC_CHART_THEME } from '@/lib/btc/chart-theme'
import { Plus, Trash2, RotateCcw } from 'lucide-react'

// ── Section card wrapper ────────────────────────────────────────────────────
function Section({
  title,
  subtitle,
  enabled,
  onToggle,
  children,
}: {
  title: string
  subtitle: string
  enabled?: boolean
  onToggle?: (v: boolean) => void
  children: React.ReactNode
}) {
  const dimmed = enabled === false
  return (
    <div className={`rounded-xl border bg-[#0d0d0d] p-4 transition-all ${dimmed ? 'border-zinc-800/60 opacity-60' : 'border-[#d4af37]/20'}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p>
        </div>
        {onToggle != null && (
          <Switch checked={enabled ?? true} onCheckedChange={onToggle} className="shrink-0 mt-0.5" />
        )}
      </div>
      <div className={dimmed ? 'pointer-events-none select-none' : ''}>{children}</div>
    </div>
  )
}

// ── Number input helper ──────────────────────────────────────────────────────
function Num({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] text-zinc-500">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isFinite(n)) return
          onChange(Math.min(max, Math.max(min, n)))
        }}
        className="h-9 border-zinc-700 bg-black font-mono text-xs"
      />
    </div>
  )
}

// ── Dot separator ─────────────────────────────────────────────────────────
function Rule() {
  return <div className="my-4 border-t border-zinc-800/70" />
}

// ─────────────────────────────────────────────────────────────────────────────
export function SettingsPanel() {
  const { mas, addMa, updateMa, removeMa, rsi, setRsi, macd, setMacd, stoch, setStoch, bollinger, setBollinger, zones, setZones, resetDefaults } = useBtcSettings()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Configurações</h2>
          <p className="text-xs text-zinc-500">Todos os indicadores e zonas do gráfico</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 border-zinc-700 text-xs text-zinc-400 hover:text-white" onClick={resetDefaults}>
          <RotateCcw className="h-3 w-3" />
          Repor
        </Button>
      </div>

      {/* ── Moving Averages ─────────────────────────────────────── */}
      <Section title="Moving Averages" subtitle="Médias móveis sobre o preço de fecho">
        <div className="space-y-2">
          {mas.map((ma) => (
            <div key={ma.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-black/50 px-3 py-2.5">
              {/* Color swatch + picker */}
              <div className="relative flex shrink-0 items-center">
                <span className="mr-1 h-3.5 w-1 rounded-full" style={{ backgroundColor: ma.color }} />
                <input
                  type="color"
                  value={ma.color}
                  onChange={(e) => updateMa(ma.id, { color: e.target.value })}
                  title="Cor no gráfico"
                  className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0 opacity-0 absolute inset-0"
                />
                <span className="pointer-events-none h-7 w-8 rounded border border-zinc-700 text-[9px]" style={{ backgroundColor: ma.color }} />
              </div>

              {/* Type toggle */}
              <div className="flex rounded-md border border-zinc-700 overflow-hidden">
                {(['SMA', 'EMA'] as MaType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => updateMa(ma.id, { type: t })}
                    className={`px-2.5 py-1 text-[10px] font-mono font-medium transition-colors ${ma.type === t ? 'bg-[#d4af37] text-black' : 'text-zinc-400 hover:bg-zinc-800'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Period */}
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-zinc-500 whitespace-nowrap">Período</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={ma.period}
                  onChange={(e) => updateMa(ma.id, { period: Math.min(500, Math.max(1, Number(e.target.value) || 1)) })}
                  className="h-8 w-16 border-zinc-700 bg-black font-mono text-xs"
                />
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={() => removeMa(ma.id)}
                className="ml-auto text-zinc-600 hover:text-red-400 transition-colors"
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addMa} className="mt-3 h-8 w-full gap-1.5 border-zinc-700 text-xs text-zinc-400 hover:text-white">
          <Plus className="h-3.5 w-3.5" /> Adicionar média
        </Button>
      </Section>

      {/* ── RSI + MACD side by side ──────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Section
          title="RSI"
          subtitle="Relative Strength Index · força do momento"
          enabled={rsi.enabled}
          onToggle={(v) => setRsi({ ...rsi, enabled: v })}
        >
          <div className="grid grid-cols-2 gap-2">
            <Num label="Período" value={rsi.period} min={2} max={100} onChange={(n) => setRsi({ ...rsi, period: n })} />
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-zinc-500">Linhas no gráfico</Label>
              <div className="flex h-9 items-center">
                <Switch id="rsi-levels" checked={rsi.showLevels} onCheckedChange={(c) => setRsi({ ...rsi, showLevels: c })} />
              </div>
            </div>
            <Num label="Sobrevenda" value={rsi.oversold} min={0} max={50} onChange={(n) => setRsi({ ...rsi, oversold: n })} />
            <Num label="Sobrecompra" value={rsi.overbought} min={50} max={100} onChange={(n) => setRsi({ ...rsi, overbought: n })} />
          </div>
          <Rule />
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
              <span className="h-2 w-5 rounded-sm" style={{ backgroundColor: BTC_CHART_THEME.rsiLine }} />RSI
            </span>
            {rsi.showLevels && <>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="h-2 w-5 rounded-sm" style={{ backgroundColor: BTC_CHART_THEME.rsiOversoldLine }} />{rsi.oversold}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="h-2 w-5 rounded-sm" style={{ backgroundColor: BTC_CHART_THEME.rsiOverboughtLine }} />{rsi.overbought}
              </span>
            </>}
          </div>
        </Section>

        <Section
          title="MACD"
          subtitle="Moving Average Convergence/Divergence"
          enabled={macd.enabled}
          onToggle={(v) => setMacd({ ...macd, enabled: v })}
        >
          <div className="grid grid-cols-3 gap-2">
            <Num label="Rápida" value={macd.fast} min={1} max={200} onChange={(n) => setMacd({ ...macd, fast: n })} />
            <Num label="Lenta" value={macd.slow} min={1} max={200} onChange={(n) => setMacd({ ...macd, slow: n })} />
            <Num label="Sinal" value={macd.signal} min={1} max={100} onChange={(n) => setMacd({ ...macd, signal: n })} />
          </div>
          <Rule />
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
              <span className="h-2 w-5 rounded-sm" style={{ backgroundColor: BTC_CHART_THEME.macdLine }} />Linha
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
              <span className="h-2 w-5 rounded-sm" style={{ backgroundColor: BTC_CHART_THEME.macdSignal }} />Sinal
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
              <span className="h-2 w-5 rounded-sm" style={{ backgroundColor: BTC_CHART_THEME.macdHistogramPos }} />Hist+
            </span>
          </div>
        </Section>
      </div>

      {/* ── Stochastic + Bollinger ───────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Section
          title="Stochastic"
          subtitle="Oscilador %K e %D · 0–100"
          enabled={stoch.enabled}
          onToggle={(v) => setStoch({ ...stoch, enabled: v })}
        >
          <div className="grid grid-cols-3 gap-2">
            <Num label="%K período" value={stoch.kPeriod} min={1} max={100} onChange={(n) => setStoch({ ...stoch, kPeriod: n })} />
            <Num label="%D período" value={stoch.dPeriod} min={1} max={50} onChange={(n) => setStoch({ ...stoch, dPeriod: n })} />
            <Num label="Suavização" value={stoch.smooth} min={1} max={20} onChange={(n) => setStoch({ ...stoch, smooth: n })} />
          </div>
          <Rule />
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500"><span className="h-2 w-5 rounded-sm" style={{ backgroundColor: BTC_CHART_THEME.stochK }} />%K (rápido)</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500"><span className="h-2 w-5 rounded-sm" style={{ backgroundColor: BTC_CHART_THEME.stochD }} />%D (suavizado)</span>
          </div>
        </Section>

        <Section
          title="Bollinger Bands"
          subtitle="Bandas de volatilidade ± desvio padrão"
          enabled={bollinger.enabled}
          onToggle={(v) => setBollinger({ ...bollinger, enabled: v })}
        >
          <div className="grid grid-cols-2 gap-2">
            <Num label="Período (SMA)" value={bollinger.period} min={5} max={200} onChange={(n) => setBollinger({ ...bollinger, period: n })} />
            <Num label="Desvio (σ)" value={bollinger.stdDev} min={0.5} max={4} step={0.1} onChange={(n) => setBollinger({ ...bollinger, stdDev: n })} />
          </div>
          <Rule />
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            {([['showUpper', 'Superior'], ['showMiddle', 'Média'], ['showLower', 'Inferior']] as const).map(([key, label]) => (
              <div key={key} className="flex flex-col items-center gap-1 rounded border border-zinc-800 bg-black/50 p-2">
                <span className="text-zinc-500">{label}</span>
                <Switch
                  checked={bollinger[key]}
                  onCheckedChange={(c) => setBollinger({ ...bollinger, [key]: c })}
                />
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Zonas de Preço ───────────────────────────────────────── */}
      <Section
        title="Zonas de Preço"
        subtitle="Linhas horizontais no gráfico (suporte, resistência, valor justo)"
        enabled={zones.enabled}
        onToggle={(v) => setZones({ ...zones, enabled: v })}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-black/50 px-3 py-2.5">
            <div>
              <p className="text-xs font-medium text-zinc-300">Zonas de MAs (50/100/200)</p>
              <p className="text-[10px] text-zinc-600">Linhas tracejadas nas médias longas</p>
            </div>
            <Switch checked={zones.showMaZones} onCheckedChange={(c) => setZones({ ...zones, showMaZones: c })} />
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-black/50 px-3 py-2.5">
            <div>
              <p className="text-xs font-medium text-zinc-300">Suporte / Resistência recente</p>
              <p className="text-[10px] text-zinc-600">Máximo e mínimo das últimas 50 velas</p>
            </div>
            <Switch checked={zones.showSupportResistance} onCheckedChange={(c) => setZones({ ...zones, showSupportResistance: c })} />
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-black/50 px-3 py-2.5">
            <div>
              <p className="text-xs font-medium text-zinc-300">Multiplicadores de Valor Justo</p>
              <p className="text-[10px] text-zinc-600">MA200 × 0.6 / 0.8 / 1.0 / 1.4 / 1.8</p>
            </div>
            <Switch checked={zones.showSmartMultipliers} onCheckedChange={(c) => setZones({ ...zones, showSmartMultipliers: c })} />
          </div>
        </div>
        <Rule />
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          {[
            { color: BTC_CHART_THEME.zoneExtremeTop, label: 'Topo Extremo (×1.8)' },
            { color: BTC_CHART_THEME.zoneWarning, label: 'Zona Aviso (×1.4)' },
            { color: BTC_CHART_THEME.zoneFairValue, label: 'Valor Justo (×1.0)' },
            { color: BTC_CHART_THEME.zoneDiscount, label: 'Desconto (×0.8)' },
            { color: BTC_CHART_THEME.zoneExtremeBottom, label: 'Fundo Extremo (×0.6)' },
            { color: BTC_CHART_THEME.zoneMa50, label: 'MA50' },
            { color: BTC_CHART_THEME.zoneMa100, label: 'MA100' },
            { color: BTC_CHART_THEME.zoneMa200, label: 'MA200' },
          ].map((z) => (
            <span key={z.label} className="flex items-center gap-1.5 text-zinc-500">
              <span className="h-2 w-5 shrink-0 rounded-sm" style={{ backgroundColor: z.color }} />
              {z.label}
            </span>
          ))}
        </div>
      </Section>
    </div>
  )
}
