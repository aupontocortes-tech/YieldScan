'use client'

import { useMemo } from 'react'
import { runSignalEngine } from '@/lib/btc/signal-engine'
import type { OhlcvBar } from '@/lib/btc/types'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'

export function MarketCard({ bars }: { bars: OhlcvBar[] }) {
  const { rsi } = useBtcSettings()

  const result = useMemo(() => {
    if (bars.length < 50) return null
    const closes = bars.map((b) => b.close)
    const vols = bars.map((b) => b.volume)
    return runSignalEngine(closes, vols, rsi)
  }, [bars, rsi])

  const last = bars.length > 0 ? bars[bars.length - 1] : null
  const prev = bars.length > 1 ? bars[bars.length - 2] : null
  const ch =
    last && prev && prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : null

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-[#d4af37]/35 bg-gradient-to-br from-black via-[#0a0a0a] to-[#111] p-4 shadow-[inset_0_1px_0_rgba(212,175,55,0.12)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4af37]/90">
          BTC market status
        </p>
        <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
          {last ? `US$ ${last.close.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
        </p>
        {ch != null && (
          <p className={ch >= 0 ? 'mt-1 text-sm text-emerald-400' : 'mt-1 text-sm text-red-400'}>
            {ch >= 0 ? '+' : ''}
            {ch.toFixed(2)}% vs velas anterior
          </p>
        )}
        <p className="mt-2 text-[11px] text-zinc-500">Fonte: Binance · BTCUSDT</p>
      </div>

      <div className="rounded-xl border border-[#d4af37]/35 bg-gradient-to-br from-black via-[#0a0a0a] to-[#111] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4af37]/90">
          Market score
        </p>
        {result ? (
          <>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#d4af37]">{result.score}</p>
            <p className="mt-1 text-sm text-zinc-300">{result.marketRegime}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Dados insuficientes</p>
        )}
      </div>

      <div className="rounded-xl border border-[#d4af37]/35 bg-gradient-to-br from-black via-[#0a0a0a] to-[#111] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4af37]/90">Signal</p>
        {result ? (
          <p className="mt-2 text-lg font-semibold leading-snug text-white">{result.tradeSignal}</p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">—</p>
        )}
      </div>
    </div>
  )
}
