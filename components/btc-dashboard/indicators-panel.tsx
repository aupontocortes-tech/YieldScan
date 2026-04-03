'use client'

import { useMemo } from 'react'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import { bollingerBands, macd, movingAverage, rsi, sma, stochastic } from '@/lib/btc/indicators'
import type { OhlcvBar } from '@/lib/btc/types'

function lastNonNull(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) { if (arr[i] != null) return arr[i] }
  return null
}

function fmt(v: number | null, digits = 2) {
  return v != null && Number.isFinite(v) ? v.toFixed(digits) : '—'
}

function Chip({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
}

function Card({ title, subtitle, badge, children }: { title: string; subtitle?: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-800/80 bg-[#0d0d0d] p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#d4af37]/80">{title}</p>
          {subtitle && <p className="mt-0.5 text-[9px] text-zinc-600">{subtitle}</p>}
        </div>
        {badge}
      </div>
      {children}
    </div>
  )
}

function RsiBadge({ v }: { v: number | null }) {
  if (v == null) return null
  const color = v < 30 ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-300' : v > 70 ? 'border-red-500/50 bg-red-950/50 text-red-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400'
  const label = v < 30 ? 'Sobrevenda' : v > 70 ? 'Sobrecompra' : 'Neutro'
  return <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${color}`}>{label}</span>
}

export function IndicatorsPanel({ bars }: { bars: OhlcvBar[] }) {
  const { mas, rsi: rsiCfg, macd: macdCfg, stoch: stochCfg, bollinger: bbCfg } = useBtcSettings()

  const snap = useMemo(() => {
    if (bars.length < 5) return null
    const closes = bars.map((b) => b.close)
    const highs = bars.map((b) => b.high)
    const lows = bars.map((b) => b.low)
    const price = closes[closes.length - 1]

    const rsiV = rsiCfg.enabled ? rsi(closes, rsiCfg.period) : null
    const m = macdCfg.enabled ? macd(closes, macdCfg.fast, macdCfg.slow, macdCfg.signal) : null
    const st = stochCfg.enabled ? stochastic(highs, lows, closes, stochCfg.kPeriod, stochCfg.dPeriod, stochCfg.smooth) : null

    let bb: { u: number | null; mid: number | null; lo: number | null } | null = null
    if (bbCfg.enabled && closes.length >= bbCfg.period) {
      const b = bollingerBands(closes, bbCfg.period, bbCfg.stdDev)
      const i = closes.length - 1
      bb = { u: b.upper[i], mid: b.middle[i], lo: b.lower[i] }
    }

    const maVals = mas.map((ma) => ({
      label: `${ma.type} ${ma.period}`,
      color: ma.color,
      value: lastNonNull(movingAverage(closes, ma.period, ma.type)),
    }))

    // MA200 for extra context
    const ma200val = lastNonNull(sma(closes, 200))

    return {
      price,
      rsiVal: rsiV ? lastNonNull(rsiV) : null,
      macdLine: m ? lastNonNull(m.line) : null,
      macdSignal: m ? lastNonNull(m.signal) : null,
      macdHist: m ? lastNonNull(m.hist) : null,
      stochK: st ? lastNonNull(st.k) : null,
      stochD: st ? lastNonNull(st.d) : null,
      bb,
      maVals,
      ma200val,
    }
  }, [bars, mas, rsiCfg, macdCfg, stochCfg, bbCfg])

  if (!snap) return null

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Indicadores (última vela)</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* RSI */}
        {rsiCfg.enabled && (
          <Card title={`RSI (${rsiCfg.period})`} subtitle="Força do momentum · 0–100" badge={<RsiBadge v={snap.rsiVal} />}>
            <p className="font-mono text-2xl font-bold text-white tabular-nums">{fmt(snap.rsiVal)}</p>
            <div className="mt-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              {snap.rsiVal != null && (
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${snap.rsiVal}%`,
                    backgroundColor: snap.rsiVal < 30 ? '#22c55e' : snap.rsiVal > 70 ? '#ef4444' : '#d4af37',
                  }}
                />
              )}
            </div>
          </Card>
        )}

        {/* MACD */}
        {macdCfg.enabled && (
          <Card title="MACD" subtitle={`Rápida ${macdCfg.fast} · Lenta ${macdCfg.slow} · Sinal ${macdCfg.signal}`}>
            <div className="grid grid-cols-3 gap-1">
              <div>
                <p className="text-[9px] text-zinc-600">Linha</p>
                <p className="font-mono text-sm font-semibold text-white tabular-nums">{fmt(snap.macdLine, 4)}</p>
              </div>
              <div>
                <p className="text-[9px] text-zinc-600">Sinal</p>
                <p className="font-mono text-sm font-semibold text-zinc-300 tabular-nums">{fmt(snap.macdSignal, 4)}</p>
              </div>
              <div>
                <p className="text-[9px] text-zinc-600">Hist.</p>
                <p className={`font-mono text-sm font-semibold tabular-nums ${(snap.macdHist ?? 0) >= 0 ? 'text-[#d4af37]' : 'text-red-400'}`}>
                  {fmt(snap.macdHist, 4)}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Stochastic */}
        {stochCfg.enabled && (
          <Card title="Stochastic" subtitle={`%K(${stochCfg.kPeriod}) · %D(${stochCfg.dPeriod}) · σ${stochCfg.smooth}`}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] text-zinc-600">%K (rápido)</p>
                <p className="font-mono text-2xl font-bold text-white tabular-nums">{fmt(snap.stochK, 1)}</p>
              </div>
              <div>
                <p className="text-[9px] text-zinc-600">%D (suavizado)</p>
                <p className="font-mono text-2xl font-bold text-zinc-300 tabular-nums">{fmt(snap.stochD, 1)}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Bollinger */}
        {bbCfg.enabled && snap.bb && (
          <Card title={`Bollinger (${bbCfg.period}, σ${bbCfg.stdDev})`} subtitle="Bandas de volatilidade">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] text-zinc-500"><Chip color="#94a3b8" />Superior</span>
                <span className="font-mono text-xs text-white">{fmt(snap.bb.u)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] text-zinc-500"><Chip color="#d4af37" />Média</span>
                <span className="font-mono text-xs text-white">{fmt(snap.bb.mid)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] text-zinc-500"><Chip color="#64748b" />Inferior</span>
                <span className="font-mono text-xs text-white">{fmt(snap.bb.lo)}</span>
              </div>
              {snap.bb.u != null && snap.bb.lo != null && (
                <p className="text-[9px] text-zinc-600">
                  Largura: {fmt(snap.bb.u - snap.bb.lo)} · Preço: {fmt(snap.price)}
                </p>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Moving Averages compact table */}
      {snap.maVals.length > 0 && (
        <div className="rounded-xl border border-zinc-800/80 bg-[#0d0d0d] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#d4af37]/80">Moving Averages</p>
          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {snap.maVals.map((row) => {
              const diff = row.value != null && snap.price > 0 ? ((snap.price - row.value) / snap.price) * 100 : null
              return (
                <div key={row.label} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[10px]">
                    <span className="h-2 w-5 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
                    <span className="font-mono text-zinc-400">{row.label}</span>
                  </span>
                  <span className="font-mono text-xs text-white">{row.value != null ? row.value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}</span>
                  {diff != null && (
                    <span className={`text-[9px] font-mono ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
