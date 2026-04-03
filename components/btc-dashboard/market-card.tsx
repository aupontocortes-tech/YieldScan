'use client'

import { useQuery } from '@tanstack/react-query'
import type { SignalEngineResult } from '@/lib/btc/signal-engine'
import type { OhlcvBar } from '@/lib/btc/types'
import { cn } from '@/lib/utils'

type BtcContextPayload = {
  coingecko: { usd: number; change24h: number | null } | null
  defiTvlUsd: number | null
  hashRateEH: number | null
  errors: string[]
}

async function fetchBtcContext(): Promise<BtcContextPayload> {
  const r = await fetch('/api/btc-context')
  if (!r.ok) throw new Error('context')
  return r.json() as Promise<BtcContextPayload>
}

export function MarketCard({ bars, signal }: { bars: OhlcvBar[]; signal: SignalEngineResult | null }) {
  const { data: ctx } = useQuery({
    queryKey: ['btc-context'],
    queryFn: fetchBtcContext,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  })

  const last = bars.length > 0 ? bars[bars.length - 1] : null
  const prev = bars.length > 1 ? bars[bars.length - 2] : null
  const ch =
    last && prev && prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : null

  const trendLabel =
    signal?.trendBullish === true ? 'Bullish (EMA9 > EMA21)' : signal?.trendBullish === false ? 'Bearish (EMA9 ≤ EMA21)' : '—'

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#d4af37]/35 bg-gradient-to-br from-black via-[#0a0a0a] to-[#111] p-4 shadow-[inset_0_1px_0_rgba(212,175,55,0.12)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4af37]/90">BTC / USDT</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
            {last
              ? `US$ ${last.close.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </p>
          {ch != null && (
            <p className={ch >= 0 ? 'mt-1 text-sm text-emerald-400' : 'mt-1 text-sm text-red-400'}>
              {ch >= 0 ? '+' : ''}
              {ch.toFixed(2)}% vs previous bar
            </p>
          )}
          <p className="mt-2 text-[11px] text-zinc-500">Binance klines (last candle)</p>
        </div>

        <div className="rounded-xl border border-[#d4af37]/35 bg-gradient-to-br from-black via-[#0a0a0a] to-[#111] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4af37]/90">Market score</p>
          {signal ? (
            <>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#d4af37]">{signal.score}</p>
              <p className="mt-1 text-sm font-medium text-zinc-200">{signal.marketRegime}</p>
              <p className="mt-2 text-[10px] uppercase tracking-wide text-zinc-500">Range −100 … +100</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">Need more bars for model</p>
          )}
        </div>

        <div className="rounded-xl border border-[#d4af37]/35 bg-gradient-to-br from-black via-[#0a0a0a] to-[#111] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4af37]/90">Signal</p>
          {signal ? (
            <p className="mt-2 text-lg font-semibold leading-snug text-white">{signal.tradeSignal}</p>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">—</p>
          )}
          <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Trend</p>
          <p className="mt-0.5 text-xs text-zinc-300">{trendLabel}</p>
        </div>

        <div className="rounded-xl border border-[#d4af37]/35 bg-gradient-to-br from-black via-[#0a0a0a] to-[#111] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4af37]/90">Free APIs</p>
          {ctx?.coingecko ? (
            <>
              <p className="mt-2 font-mono text-sm tabular-nums text-white">
                CG US$ {ctx.coingecko.usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
              {ctx.coingecko.change24h != null && (
                <p
                  className={cn(
                    'mt-1 text-xs',
                    ctx.coingecko.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {ctx.coingecko.change24h >= 0 ? '+' : ''}
                  {ctx.coingecko.change24h.toFixed(2)}% 24h
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">CoinGecko — n/a</p>
          )}
          {ctx?.defiTvlUsd != null && (
            <p className="mt-2 text-[11px] text-zinc-400">
              DeFi TVL (Llama){' '}
              <span className="font-mono text-zinc-200">
                US$
                {(ctx.defiTvlUsd / 1e9).toFixed(2)}B
              </span>
            </p>
          )}
          {ctx?.hashRateEH != null && (
            <p className="mt-1 text-[11px] text-zinc-500">
              Est. hash ·{' '}
              <span className="font-mono text-zinc-400">{ctx.hashRateEH.toFixed(1)} EH/s</span>
              <span className="text-zinc-600"> · blockchain.com</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
