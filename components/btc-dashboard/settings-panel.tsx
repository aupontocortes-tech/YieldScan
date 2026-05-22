'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CycleBottomPanel } from '@/components/btc-dashboard/cycle-bottom-panel'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import type { MaType } from '@/lib/btc/types'
import { BTC_CHART_THEME } from '@/lib/btc/chart-theme'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus, Trash2, RotateCcw, CircleHelp, ChevronDown } from 'lucide-react'

function HelpTip({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          className="inline-flex shrink-0 cursor-pointer rounded p-0.5 text-zinc-500 transition-colors hover:text-[#d4af37] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#d4af37]/50"
          aria-label="Explicação do indicador"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') e.preventDefault()
          }}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        className="w-[min(100vw-2rem,20rem)] border-zinc-700 bg-[#141414] p-3 text-[11px] leading-relaxed text-zinc-300 shadow-xl"
      >
        {text}
      </PopoverContent>
    </Popover>
  )
}

const MA_PALETTE = [
  '#D4AF37', '#ef4444', '#22c55e', '#38bdf8',
  '#a855f7', '#f97316', '#ec4899', '#fafafa',
  '#78716c', '#6366f1', '#14b8a6', '#facc15',
]

// ── Indicador em acordeão (título clicável abre opções) ─────────────────────
function IndicatorSection({
  title,
  subtitle,
  helpText,
  enabled,
  onToggle,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle: string
  helpText?: string
  enabled?: boolean
  onToggle?: (v: boolean) => void
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const dimmed = onToggle != null && enabled === false

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        'rounded-xl border bg-[#0d0d0d] transition-all',
        dimmed ? 'border-zinc-800/60 opacity-60' : 'border-[#d4af37]/20',
      )}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-2 rounded-md text-left transition-colors hover:bg-zinc-900/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#d4af37]/40"
          >
            <ChevronDown
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200',
                open && 'rotate-180',
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-white">{title}</span>
                {helpText ? (
                  <span
                    className="inline-flex"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <HelpTip text={helpText} />
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p>
            </div>
          </button>
        </CollapsibleTrigger>
        {onToggle != null && (
          <div
            className="shrink-0 pt-0.5"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Switch checked={enabled ?? true} onCheckedChange={onToggle} />
          </div>
        )}
      </div>
      <CollapsibleContent>
        <div
          className={cn(
            'border-t border-zinc-800/70 px-3 pb-3 pt-3',
            dimmed && 'pointer-events-none select-none',
          )}
        >
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
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
export function SettingsPanel({
  embedded = false,
  onChartViewApplied,
  onGoldenCrossFullscreen,
}: {
  embedded?: boolean
  /** Ao mudar o intervalo via fundos de ciclo, fecha o painel para ver o gráfico. */
  onChartViewApplied?: () => void
  /** Abre Golden / Death Cross em ecrã inteiro. */
  onGoldenCrossFullscreen?: () => void
}) {
  const {
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
    zones,
    setZones,
    candles,
    setCandles,
    onChain,
    setOnChain,
    resetDefaults,
  } = useBtcSettings()

  return (
    <div className="space-y-2">
      {!embedded && (
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Configurações</h2>
            <p className="text-xs text-zinc-500">Clica no nome do indicador para abrir as opções</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 border-zinc-700 text-xs text-zinc-400 hover:text-white" onClick={resetDefaults}>
            <RotateCcw className="h-3 w-3" />
            Repor
          </Button>
        </div>
      )}

      <IndicatorSection
        title="Fundos de ciclo · Bull market (Pompx)"
        subtitle="Golden Cross, SMA 200, SMA 50 semanal, Bull Market Band"
        helpText="Quatro cartões no mesmo formato. O Golden Cross abre em ecrã inteiro (SMA 50 + 200 no diário)."
      >
        <CycleBottomPanel
          variant="settings"
          compact
          onChartViewApplied={onChartViewApplied}
          onFullscreenFocus={onGoldenCrossFullscreen}
        />
      </IndicatorSection>

      <IndicatorSection
        title="Velas (BTC / USDT)"
        subtitle="Corpo, bordas e pavios do gráfico de velas — clica na cor para mudar"
        helpText="Define apenas as cores das velas (alta, baixa e pavio da baixa). Não altera preços nem intervalo — é puramente aparência."
      >
        <p className="mb-2 text-[10px] text-zinc-600">Clica para mudar a cor</p>
        <div className="flex flex-wrap gap-3">
          <ColorDot
            label="Alta (corpo, borda, pavio)"
            color={candles.colors.up}
            onChange={(c) => setCandles({ ...candles, colors: { ...candles.colors, up: c } })}
          />
          <ColorDot
            label="Baixa (corpo e borda)"
            color={candles.colors.down}
            onChange={(c) => setCandles({ ...candles, colors: { ...candles.colors, down: c } })}
          />
          <ColorDot
            label="Pavio da baixa"
            color={candles.colors.wickDown}
            onChange={(c) => setCandles({ ...candles, colors: { ...candles.colors, wickDown: c } })}
          />
        </div>
      </IndicatorSection>

      <IndicatorSection
        title="Moving Averages"
        subtitle="Médias móveis sobre o preço de fecho — clica nas bolinhas para mudar a cor"
        helpText="SMA ou EMA do fecho, desenhadas no mesmo gráfico do preço. Períodos maiores reagem mais devagar; podes empilhar várias médias para ver tendência e possíveis suportes/resistências dinâmicos."
      >
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

                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-zinc-500">Linha</Label>
                  <select
                    value={ma.lineWidth}
                    onChange={(e) => updateMa(ma.id, { lineWidth: Number(e.target.value) as 1 | 2 | 3 })}
                    className="h-8 rounded border border-zinc-700 bg-black px-1.5 font-mono text-[10px] text-zinc-300"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
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
      </IndicatorSection>

      <IndicatorSection
          title="RSI"
          subtitle="Relative Strength Index · força do momento"
          helpText="Oscilador 0–100 que mede a força dos últimos ganhos vs perdas. Zonas de sobrevenda/sobrecompra são referências comuns; aparece num painel separado abaixo do gráfico de preço quando ativo."
          enabled={rsi.enabled}
          onToggle={(v) => setRsi({ ...rsi, enabled: v })}
        >
          <div className="grid grid-cols-2 gap-2">
            <Num label="Período" value={rsi.period} min={2} max={100} onChange={(n) => setRsi({ ...rsi, period: n })} />
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-zinc-500">Espessura</Label>
              <select
                value={rsi.lineWidth}
                onChange={(e) => setRsi({ ...rsi, lineWidth: Number(e.target.value) as 1 | 2 | 3 })}
                className="h-9 rounded-md border border-zinc-700 bg-black px-2 font-mono text-xs text-zinc-300"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
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
      </IndicatorSection>

      <IndicatorSection
          title="MACD"
          subtitle="Moving Average Convergence/Divergence"
          helpText="Diferença entre duas EMAs do preço, com linha de sinal. O histograma mostra se o momentum está a acelerar ou a travar; painel dedicado abaixo do preço."
          enabled={macd.enabled}
          onToggle={(v) => setMacd({ ...macd, enabled: v })}
        >
          <div className="grid grid-cols-3 gap-2">
            <Num label="Rápida" value={macd.fast} min={1} max={200} onChange={(n) => setMacd({ ...macd, fast: n })} />
            <Num label="Lenta" value={macd.slow} min={1} max={200} onChange={(n) => setMacd({ ...macd, slow: n })} />
            <Num label="Sinal" value={macd.signal} min={1} max={100} onChange={(n) => setMacd({ ...macd, signal: n })} />
          </div>
          <div className="mt-2">
            <Label className="text-[10px] text-zinc-500">Espessura linha MACD</Label>
            <select
              value={macd.lineWidth}
              onChange={(e) => setMacd({ ...macd, lineWidth: Number(e.target.value) as 1 | 2 | 3 })}
              className="mt-1 h-9 w-full rounded-md border border-zinc-700 bg-black px-2 font-mono text-xs text-zinc-300"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
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
      </IndicatorSection>

      <IndicatorSection
          title="Stochastic"
          subtitle="Oscilador %K e %D · 0–100"
          helpText="%K compara o fecho com o intervalo recente; %D suaviza %K. Indica posição relativa dentro da gama (útil em ranges); painel separado."
          enabled={stoch.enabled}
          onToggle={(v) => setStoch({ ...stoch, enabled: v })}
        >
          <div className="grid grid-cols-3 gap-2">
            <Num label="%K período" value={stoch.kPeriod} min={1} max={100} onChange={(n) => setStoch({ ...stoch, kPeriod: n })} />
            <Num label="%D período" value={stoch.dPeriod} min={1} max={50} onChange={(n) => setStoch({ ...stoch, dPeriod: n })} />
            <Num label="Suavização" value={stoch.smooth} min={1} max={20} onChange={(n) => setStoch({ ...stoch, smooth: n })} />
          </div>
          <div className="mt-2">
            <Label className="text-[10px] text-zinc-500">Espessura %K</Label>
            <select
              value={stoch.lineWidth}
              onChange={(e) => setStoch({ ...stoch, lineWidth: Number(e.target.value) as 1 | 2 | 3 })}
              className="mt-1 h-9 w-full rounded-md border border-zinc-700 bg-black px-2 font-mono text-xs text-zinc-300"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
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
      </IndicatorSection>

      <IndicatorSection
        title="Zonas de Preço"
        subtitle="Linhas horizontais no gráfico (suporte, resistência, valor justo)"
        helpText="Desenha linhas de preço fixas no gráfico principal: médias 50/100/200, máximo e mínimo das últimas 50 velas, e níveis = MA200 × fatores (desconto/prémio). Ajuda a marcar zonas sem olhar só para o zigzag do preço."
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
      </IndicatorSection>

      <p className="px-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        On-chain no gráfico de preço
      </p>
      <p className="px-1 pb-1 text-[11px] leading-relaxed text-amber-200/80">
        Linha tracejada no gráfico (USD), com nome e valor na escala. Proxies só com preço — valida com fontes on-chain
        reais para decisões.
      </p>

      <IndicatorSection
        title="Mayer Multiple (proxy)"
        subtitle="Preço ÷ SMA · linha no gráfico de preço"
        helpText="Preço ÷ SMA (200 por defeito). Mostra linha horizontal no gráfico ao nível da SMA (Mayer = 1) e o valor actual da métrica no rótulo."
        enabled={onChain.mayer.enabled}
        onToggle={(c) => setOnChain((p) => ({ ...p, mayer: { ...p.mayer, enabled: c } }))}
      >
        <div className="grid grid-cols-2 gap-2">
          <Num label="SMA base" value={onChain.mayer.smaPeriod} min={50} max={500} onChange={(n) => setOnChain((p) => ({ ...p, mayer: { ...p.mayer, smaPeriod: n } }))} />
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-zinc-500">Cor</Label>
            <input type="color" value={onChain.mayer.color} onChange={(e) => setOnChain((p) => ({ ...p, mayer: { ...p.mayer, color: e.target.value } }))} className="h-9 w-full cursor-pointer rounded border border-zinc-700 bg-black" />
          </div>
        </div>
      </IndicatorSection>

      <IndicatorSection
        title="AVIV (proxy)"
        subtitle="Preço ÷ SMA · linha no gráfico de preço"
        helpText="Proxy preço ÷ SMA (100 por defeito). Linha no gráfico de preço com rótulo AVIV e preço USD na escala."
        enabled={onChain.aviv.enabled}
        onToggle={(c) => setOnChain((p) => ({ ...p, aviv: { ...p.aviv, enabled: c } }))}
      >
        <div className="grid grid-cols-2 gap-2">
          <Num label="SMA base" value={onChain.aviv.smaPeriod} min={20} max={300} onChange={(n) => setOnChain((p) => ({ ...p, aviv: { ...p.aviv, smaPeriod: n } }))} />
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-zinc-500">Cor</Label>
            <input type="color" value={onChain.aviv.color} onChange={(e) => setOnChain((p) => ({ ...p, aviv: { ...p.aviv, color: e.target.value } }))} className="h-9 w-full cursor-pointer rounded border border-zinc-700 bg-black" />
          </div>
        </div>
      </IndicatorSection>

      <IndicatorSection
        title="MVRV (proxy)"
        subtitle="Linha no preço ‘justo’ (MVRV proxy = 1)"
        helpText="Linha no gráfico ao preço ‘justo’ (MVRV proxy = 1). Rótulo com valor actual e tag WATCH/NORMAL."
        enabled={onChain.mvrv.enabled}
        onToggle={(c) => setOnChain((p) => ({ ...p, mvrv: { ...p.mvrv, enabled: c } }))}
      >
        <div className="grid grid-cols-2 gap-2">
          <Num label="SMA base" value={onChain.mvrv.smaPeriod} min={50} max={500} onChange={(n) => setOnChain((p) => ({ ...p, mvrv: { ...p.mvrv, smaPeriod: n } }))} />
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-zinc-500">Cor</Label>
            <input
              type="color"
              value={onChain.mvrv.color}
              onChange={(e) => setOnChain((p) => ({ ...p, mvrv: { ...p.mvrv, color: e.target.value } }))}
              className="h-9 w-full cursor-pointer rounded border border-zinc-700 bg-black"
            />
          </div>
        </div>
      </IndicatorSection>

      <IndicatorSection
        title="MVRV Z-Score (proxy)"
        subtitle="Z-score da proxy MVRV"
        helpText="Linha no gráfico no preço onde a proxy MVRV está na média da janela; rótulo com Z-score actual."
        enabled={onChain.mvrvZ.enabled}
        onToggle={(c) => setOnChain((p) => ({ ...p, mvrvZ: { ...p.mvrvZ, enabled: c } }))}
      >
        <Num label="Janela Z" value={onChain.mvrvZ.window} min={20} max={200} onChange={(n) => setOnChain((p) => ({ ...p, mvrvZ: { ...p.mvrvZ, window: n } }))} />
      </IndicatorSection>

      <IndicatorSection
        title="SOPR (proxy)"
        subtitle="Linha na EMA base (SOPR proxy ≈ 1)"
        helpText="Linha no gráfico na EMA base (SOPR proxy ≈ 1). Nome e valor na escala de preços."
        enabled={onChain.sopr.enabled}
        onToggle={(c) => setOnChain((p) => ({ ...p, sopr: { ...p.sopr, enabled: c } }))}
      >
        <Num label="EMA base" value={onChain.sopr.emaPeriod} min={5} max={50} onChange={(n) => setOnChain((p) => ({ ...p, sopr: { ...p.sopr, emaPeriod: n } }))} />
      </IndicatorSection>

      <IndicatorSection
        title="NUPL (proxy)"
        subtitle="Linha no preço neutro (NUPL proxy = 50)"
        helpText="Linha no gráfico no preço neutro (NUPL proxy = 50). Rótulo com valor 0–100 e tag na escala USD."
        enabled={onChain.nupl.enabled}
        onToggle={(c) => setOnChain((p) => ({ ...p, nupl: { ...p.nupl, enabled: c } }))}
      >
        <div className="grid grid-cols-2 gap-2">
          <Num label="SMA base" value={onChain.nupl.smaPeriod} min={50} max={500} onChange={(n) => setOnChain((p) => ({ ...p, nupl: { ...p.nupl, smaPeriod: n } }))} />
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-zinc-500">Cor</Label>
            <input type="color" value={onChain.nupl.color} onChange={(e) => setOnChain((p) => ({ ...p, nupl: { ...p.nupl, color: e.target.value } }))} className="h-9 w-full cursor-pointer rounded border border-zinc-700 bg-black" />
          </div>
        </div>
      </IndicatorSection>

      <IndicatorSection
        title="STH vs LTH (proxy)"
        subtitle="EMA curta vs SMA longa no gráfico de preço"
        helpText="Inspirado na ideia de ‘curto’ vs ‘longo’ prazo: uma EMA curta e uma SMA longa no mesmo gráfico do BTC (USD). O valor em cada momento é um preço — vês linhas horizontais no fim do gráfico e uma barrinha com os dois níveis. Não usa dados de holders on-chain."
        enabled={onChain.sthLth.enabled}
        onToggle={(c) => setOnChain((p) => ({ ...p, sthLth: { ...p.sthLth, enabled: c } }))}
      >
        <div className="grid grid-cols-2 gap-2">
          <Num
            label="Período EMA (STH)"
            value={onChain.sthLth.rsiPeriod}
            min={3}
            max={50}
            onChange={(n) => setOnChain((p) => ({ ...p, sthLth: { ...p.sthLth, rsiPeriod: n } }))}
          />
          <Num
            label="Período SMA (LTH)"
            value={onChain.sthLth.smaPeriod}
            min={20}
            max={500}
            onChange={(n) => setOnChain((p) => ({ ...p, sthLth: { ...p.sthLth, smaPeriod: n } }))}
          />
        </div>
      </IndicatorSection>

      {embedded && (
        <Button
          type="button"
          variant="outline"
          className="w-full border-white/10 bg-transparent text-xs text-zinc-400 hover:text-white"
          onClick={resetDefaults}
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Repor todos os indicadores
        </Button>
      )}
    </div>
  )
}
