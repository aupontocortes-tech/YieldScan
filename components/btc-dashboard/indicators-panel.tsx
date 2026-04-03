'use client'

import { useMemo } from 'react'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import { bollingerBands, macd, movingAverage, rsi, stochastic } from '@/lib/btc/indicators'
import type { OhlcvBar } from '@/lib/btc/types'

function lastNonNull(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i]
  }
  return null
}

export function IndicatorsPanel({ bars }: { bars: OhlcvBar[] }) {
  const { mas, rsi: rsiCfg, macd: macdCfg, stoch: stochCfg, bollinger: bbCfg } = useBtcSettings()

  const snap = useMemo(() => {
    if (bars.length < 5) return null
    const closes = bars.map((b) => b.close)
    const highs = bars.map((b) => b.high)
    const lows = bars.map((b) => b.low)
    const rsiV = rsi(closes, rsiCfg.period)
    const m = macd(closes, macdCfg.fast, macdCfg.slow, macdCfg.signal)
    const st = stochastic(highs, lows, closes, stochCfg.kPeriod, stochCfg.dPeriod, stochCfg.smooth)
    const maVals = mas.map((ma) => ({
      label: `${ma.type} ${ma.period}`,
      color: ma.color,
      value: lastNonNull(movingAverage(closes, ma.period, ma.type)),
    }))
    let bb: { u: number | null; mid: number | null; lo: number | null } | null = null
    if (bbCfg.enabled && closes.length >= bbCfg.period) {
      const b = bollingerBands(closes, bbCfg.period, bbCfg.stdDev)
      const i = closes.length - 1
      bb = { u: b.upper[i], mid: b.middle[i], lo: b.lower[i] }
    }
    return {
      rsi: lastNonNull(rsiV),
      macd: lastNonNull(m.line),
      signal: lastNonNull(m.signal),
      hist: lastNonNull(m.hist),
      stochK: lastNonNull(st.k),
      stochD: lastNonNull(st.d),
      maVals,
      bb,
    }
  }, [bars, mas, rsiCfg.period, macdCfg, stochCfg, bbCfg])

  if (!snap) {
    return (
      <div className="rounded-xl border border-[#d4af37]/20 bg-black/50 p-4 text-sm text-zinc-500">
        Indicators — waiting for data.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#d4af37]/25 bg-[#080808] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#d4af37]/90">Indicators (last bar)</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-lg border border-zinc-800/80 bg-black/40 p-3">
          <p className="text-[10px] uppercase text-zinc-500">RSI ({rsiCfg.period})</p>
          <p className="mt-1 font-mono text-xl text-white">{snap.rsi != null ? snap.rsi.toFixed(2) : '—'}</p>
        </div>
        <div className="rounded-lg border border-zinc-800/80 bg-black/40 p-3">
          <p className="text-[10px] uppercase text-zinc-500">MACD / Signal / Hist</p>
          <p className="mt-1 font-mono text-sm text-white">
            {snap.macd != null ? snap.macd.toFixed(4) : '—'} · {snap.signal != null ? snap.signal.toFixed(4) : '—'} ·{' '}
            {snap.hist != null ? snap.hist.toFixed(4) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800/80 bg-black/40 p-3">
          <p className="text-[10px] uppercase text-zinc-500">Stochastic %K / %D</p>
          <p className="mt-1 font-mono text-xl text-white">
            {snap.stochK != null ? snap.stochK.toFixed(1) : '—'} / {snap.stochD != null ? snap.stochD.toFixed(1) : '—'}
          </p>
        </div>
        {snap.bb && (
          <div className="rounded-lg border border-zinc-800/80 bg-black/40 p-3">
            <p className="text-[10px] uppercase text-zinc-500">
              Bollinger ({bbCfg.period}, σ{bbCfg.stdDev})
            </p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-white">
              ↑ {snap.bb.u != null ? snap.bb.u.toFixed(2) : '—'}
              <br />
              — {snap.bb.mid != null ? snap.bb.mid.toFixed(2) : '—'}
              <br />↓ {snap.bb.lo != null ? snap.bb.lo.toFixed(2) : '—'}
            </p>
          </div>
        )}
        <div className="rounded-lg border border-zinc-800/80 bg-black/40 p-3 sm:col-span-2 lg:col-span-1 xl:col-span-1">
          <p className="text-[10px] uppercase text-zinc-500">Moving averages</p>
          <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto text-xs">
            {snap.maVals.length === 0 ? (
              <li className="text-zinc-500">None (add in settings)</li>
            ) : (
              snap.maVals.map((row) => (
                <li key={row.label} className="flex justify-between gap-2 font-mono">
                  <span style={{ color: row.color }}>{row.label}</span>
                  <span className="text-zinc-200">{row.value != null ? row.value.toFixed(2) : '—'}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
