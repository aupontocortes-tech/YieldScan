'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import type { MaType } from '@/lib/btc/types'
import { BTC_CHART_THEME } from '@/lib/btc/chart-theme'
import { cn } from '@/lib/utils'
import { Plus, Trash2, RotateCcw } from 'lucide-react'

const MA_PALETTE = [
  '#D4AF37', '#ef4444', '#22c55e', '#38bdf8',
  '#a855f7', '#f97316', '#ec4899', '#fafafa',
  '#78716c', '#6366f1', '#14b8a6', '#facc15',
]

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

// ── Interactive color dot — click to open native color picker ──────────────
function ColorDot({
  label,
  color,
  onChange,
}: {
  label: string
  color: string
  onChange: (c: string) => void
}) {
  return (
    <label
      className="group relative flex cursor-pointer items-center gap-1.5"
      title={`Cor: ${label} — clica para mudar`}
    >
      <span
        className="h-3 w-6 rounded-sm border border-zinc-700 transition-all group-hover:scale-110 group-hover:border-zinc-400"
        style={{ backgroundColor: color }}
      />
      <span className="text-[10px] text-zinc-500 transition-colors group-hover:text-zinc-300">{label}</span>
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  )
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
      <Section title="Moving Averages" subtitle="Médias móveis sobre o preço de fecho — clica nas bolinhas para mudar a cor">
        <div className="space-y-3">
          {mas.map((ma) => (
            <div key={ma.id} className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2.5 space-y-2.5">
              {/* Row 1: type + period + remove */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Color bar indicator */}
                <span className="h-5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ma.color }} />
                <span className="min-w-[52px] font-mono text-[11px] text-zinc-400">{ma.type} {ma.period}</span>

                {/* Type toggle */}
                <div className="flex overflow-hidden rounded-md border border-zinc-700">
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
                  <Label className="whitespace-nowrap text-[10px] text-zinc-500">Período</Label>
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
                  className="ml-auto text-zinc-600 transition-colors hover:text-red-400"
                  title="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Row 2: Color palette */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="shrink-0 text-[10px] text-zinc-500">Cor:</span>
                {MA_PALETTE.map((c) => {
                  const active = ma.color.toLowerCase() === c.toLowerCase()
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateMa(ma.id, { color: c })}
                      title={c}
                      className={cn(
                        'h-5 w-5 shrink-0 rounded-full border transition-all hover:scale-125',
                        active ? 'border-white scale-110 shadow-sm shadow-white/30' : 'border-zinc-700/60'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  )
                })}
                {/* Custom color picker */}
                <label
                  className="relative ml-0.5 cursor-pointer"
                  title="Cor personalizada — clica para abrir o seletor"
                >
                  <span
                    className={cn(
                      'flex h-5 w-7 items-center justify-center rounded border text-[9px] font-bold transition-colors',
                      MA_PALETTE.some((c) => c.toLowerCase() === ma.color.toLowerCase())
                        ? 'border-dashed border-zinc-600 text-zinc-500 hover:border-zinc-400'
                        : 'border-solid border-white/40'
                    )}
                    style={{
                      backgroundColor: MA_PALETTE.some((c) => c.toLowerCase() === ma.color.toLowerCase())
                        ? undefined
                        : ma.color,
                    }}
                  >
                    {MA_PALETTE.some((c) => c.toLowerCase() === ma.color.toLowerCase()) ? '+COR' : '✎'}
                  </span>
                  <input
                    type="color"
                    value={ma.color}
                    onChange={(e) => updateMa(ma.id, { color: e.target.value })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
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
          <p className="mb-2 text-[10px] text-zinc-600">Clica para mudar a cor</p>
          <div className="flex flex-wrap gap-3">
            <ColorDot
              label="RSI"
              color={rsi.colors.line}
              onChange={(c) => setRsi({ ...rsi, colors: { ...rsi.colors, line: c } })}
            />
            {rsi.showLevels && (
              <>
                <ColorDot
                  label={`Sobrevenda (${rsi.oversold})`}
                  color={rsi.colors.oversold}
                  onChange={(c) => setRsi({ ...rsi, colors: { ...rsi.colors, oversold: c } })}
                />
                <ColorDot
                  label={`Sobrecompra (${rsi.overbought})`}
                  color={rsi.colors.overbought}
                  onChange={(c) => setRsi({ ...rsi, colors: { ...rsi.colors, overbought: c } })}
                />
              </>
            )}
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
          <p className="mb-2 text-[10px] text-zinc-600">Clica para mudar a cor</p>
          <div className="flex flex-wrap gap-3">
            <ColorDot
              label="Linha"
              color={macd.colors.line}
              onChange={(c) => setMacd({ ...macd, colors: { ...macd.colors, line: c } })}
            />
            <ColorDot
              label="Sinal"
              color={macd.colors.signal}
              onChange={(c) => setMacd({ ...macd, colors: { ...macd.colors, signal: c } })}
            />
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
          <p className="mb-2 text-[10px] text-zinc-600">Clica para mudar a cor</p>
          <div className="flex flex-wrap gap-3">
            <ColorDot
              label="%K (rápido)"
              color={stoch.colors.k}
              onChange={(c) => setStoch({ ...stoch, colors: { ...stoch.colors, k: c } })}
            />
            <ColorDot
              label="%D (suavizado)"
              color={stoch.colors.d}
              onChange={(c) => setStoch({ ...stoch, colors: { ...stoch.colors, d: c } })}
            />
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
          <div className="space-y-2">
            {([
              ['showUpper', 'upper', 'Superior'] as const,
              ['showMiddle', 'middle', 'Média'] as const,
              ['showLower', 'lower', 'Inferior'] as const,
            ]).map(([toggleKey, colorKey, label]) => (
              <div key={toggleKey} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-black/50 px-3 py-2">
                <ColorDot
                  label={label}
                  color={bollinger.colors[colorKey]}
                  onChange={(c) => setBollinger({ ...bollinger, colors: { ...bollinger.colors, [colorKey]: c } })}
                />
                <Switch
                  checked={bollinger[toggleKey]}
                  onCheckedChange={(c) => setBollinger({ ...bollinger, [toggleKey]: c })}
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
