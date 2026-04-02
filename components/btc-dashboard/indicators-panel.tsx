'use client'

import { useMemo } from 'react'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import { macd, movingAverage, rsi, stochastic } from '@/lib/btc/indicators'
import type { OhlcvBar } from '@/lib/btc/types'

function lastNonNull(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i]
  }
  return null
}

export function IndicatorsPanel({ bars }: { bars: OhlcvBar[] }) {
  const { mas, rsi: rsiCfg, macd: macdCfg, stoch: stochCfg } = useBtcSettings()

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
    return {
      rsi: lastNonNull(rsiV),
      macd: lastNonNull(m.line),
      signal: lastNonNull(m.signal),
      hist: lastNonNull(m.hist),
      stochK: lastNonNull(st.k),
      stochD: lastNonNull(st.d),
      maVals,
    }
  }, [bars, mas, rsiCfg.period, macdCfg, stochCfg])

  if (!snap) {
    return (
      <div className="rounded-xl border border-[#d4af37]/20 bg-black/50 p-4 text-sm text-zinc-500">
        Indicadores — à espera de dados.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#d4af37]/25 bg-[#080808] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#d4af37]/90">Indicadores (última vela)</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="rounded-lg border border-zinc-800/80 bg-black/40 p-3 sm:col-span-2 lg:col-span-1">
          <p className="text-[10px] uppercase text-zinc-500">Médias móveis</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {snap.maVals.map((row) => (
              <li key={row.label} className="flex justify-between gap-2 font-mono">
                <span style={{ color: row.color }}>{row.label}</span>
                <span className="text-zinc-200">{row.value != null ? row.value.toFixed(2) : '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
