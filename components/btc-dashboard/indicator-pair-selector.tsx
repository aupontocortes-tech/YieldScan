'use client'

import { useMemo, useState } from 'react'
import {
  filterIndicatorPairs,
  indicatorPairSourceHint,
  resolveIndicatorPairInput,
  type IndicatorPair,
} from '@/lib/btc/indicator-pairs'
import { MERCADO_HIGHLIGHT_QUICK_PRESETS } from '@/lib/mercado-highlight-presets'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { ChevronDown, Search } from 'lucide-react'

type Props = {
  pair: IndicatorPair
  onSelect: (pair: IndicatorPair) => void
}

export function IndicatorPairSelector({ pair, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [custom, setCustom] = useState('')

  const filtered = useMemo(() => filterIndicatorPairs(query), [query])

  const rwaQuick = MERCADO_HIGHLIGHT_QUICK_PRESETS.slice(0, 6)

  const applyCustom = () => {
    const resolved = resolveIndicatorPairInput(custom)
    if (resolved) {
      onSelect(resolved)
      setOpen(false)
      setCustom('')
      setQuery('')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 max-w-[min(100%,14rem)] items-center gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5 text-left transition-colors hover:border-[#d4af37]/40 hover:bg-white/[0.04] sm:max-w-none sm:px-2.5"
          aria-label="Escolher par de moedas"
        >
          <TokenSymbolAvatar
            symbol={pair.base}
            coingeckoId={pair.coingeckoId}
            size={28}
            className="shrink-0 bg-muted/30"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{pair.label}</p>
            <p className="truncate text-[10px] text-zinc-500">{indicatorPairSourceHint(pair)}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[120] w-[min(100vw-1.5rem,22rem)] border-white/10 bg-[#0a0a0a] p-0"
      >
        <div className="border-b border-white/[0.06] p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="BTC, ETHUSDT, tesla-xstock…"
              className="h-9 border-white/10 bg-black/50 pl-8 font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="max-h-[min(50vh,320px)] overflow-y-auto p-1 [scrollbar-width:thin]">
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            RWAs · xStock
          </p>
          <div className="mb-2 flex flex-wrap gap-1 px-1">
            {rwaQuick.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  'rounded-md border px-2 py-1 text-[10px] transition-colors',
                  pair.coingeckoId === p.id
                    ? 'border-[#d4af37]/50 bg-[#d4af37]/15 text-[#d4af37]'
                    : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200',
                )}
                onClick={() => {
                  const resolved = resolveIndicatorPairInput(p.id)
                  if (resolved) {
                    onSelect(resolved)
                    setOpen(false)
                  }
                }}
              >
                {p.name}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-zinc-500">Nenhum par encontrado.</p>
          ) : (
            filtered.slice(0, 80).map((p) => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors',
                  pair.id === p.id
                    ? 'bg-[#d4af37]/15 text-[#d4af37]'
                    : 'text-zinc-300 hover:bg-white/5',
                )}
                onClick={() => {
                  onSelect(p)
                  setOpen(false)
                  setQuery('')
                }}
              >
                <TokenSymbolAvatar
                  symbol={p.base}
                  coingeckoId={p.coingeckoId}
                  size={22}
                  className="shrink-0"
                />
                <span className="min-w-0 flex-1 truncate font-medium">{p.label}</span>
                <span className="shrink-0 text-[10px] text-zinc-600">
                  {p.source === 'binance' ? 'BN' : 'CG'}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="space-y-2 border-t border-white/[0.06] p-2">
          <p className="text-[10px] text-zinc-500">
            Par personalizado: símbolo Binance (<span className="font-mono">SOLUSDT</span>) ou slug CoinGecko (
            <span className="font-mono">nvidia-xstock</span>).
          </p>
          <div className="flex gap-1.5">
            <Input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="ex. AMZNUSDT ou meta-xstock"
              className="h-8 flex-1 font-mono text-[11px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyCustom()
              }}
            />
            <Button type="button" size="sm" className="h-8 shrink-0 text-xs" onClick={applyCustom}>
              Ir
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
