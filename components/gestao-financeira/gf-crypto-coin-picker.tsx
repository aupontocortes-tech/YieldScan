'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import { cn } from '@/lib/utils'
import { Loader2, Search } from 'lucide-react'

export type GfCryptoCoinPick = {
  id: string
  name: string
  symbol: string
  image?: string
}

type Props = {
  value: GfCryptoCoinPick | null
  onChange: (coin: GfCryptoCoinPick) => void
  className?: string
}

async function searchCoins(q: string): Promise<GfCryptoCoinPick[]> {
  const res = await fetch(`/api/coingecko/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) return []
  const body = (await res.json()) as { coins?: GfCryptoCoinPick[] }
  return body.coins ?? []
}

const POPULAR: GfCryptoCoinPick[] = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'tether', name: 'Tether', symbol: 'USDT' },
  { id: 'solana', name: 'Solana', symbol: 'SOL' },
  { id: 'binancecoin', name: 'BNB', symbol: 'BNB' },
  { id: 'ripple', name: 'XRP', symbol: 'XRP' },
  { id: 'usd-coin', name: 'USD Coin', symbol: 'USDC' },
  { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' },
]

export function GfCryptoCoinPicker({ value, onChange, className }: Props) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hits, setHits] = useState<GfCryptoCoinPick[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 220)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open) return
    if (debounced.length < 2) {
      setHits([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void searchCoins(debounced).then((coins) => {
      if (!cancelled) {
        setHits(coins)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [debounced, open])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = useCallback(
    (coin: GfCryptoCoinPick) => {
      onChange(coin)
      setQuery('')
      setOpen(false)
    },
    [onChange],
  )

  const list = debounced.length >= 2 ? hits : POPULAR

  return (
    <div ref={wrapRef} className={cn('relative space-y-1', className)}>
      <Label>Moeda</Label>
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2">
          <TokenSymbolAvatar
            symbol={value.symbol}
            coingeckoId={value.id}
            iconUrl={value.image}
            size={28}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{value.symbol.toUpperCase()}</p>
            <p className="truncate text-xs text-muted-foreground">{value.name}</p>
          </div>
          <button
            type="button"
            className="text-xs text-violet-400 hover:underline"
            onClick={() => {
              setOpen(true)
              setQuery('')
            }}
          >
            Trocar
          </button>
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Pesquisar BTC, USDT, Solana…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && list[0]) {
              e.preventDefault()
              pick(list[0]!)
            }
            if (e.key === 'Escape') setOpen(false)
          }}
        />
      </div>

      {open && (
        <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-border/60 bg-popover shadow-lg">
          {loading ? (
            <li className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> CoinGecko…
            </li>
          ) : list.length === 0 ? (
            <li className="px-3 py-3 text-xs text-muted-foreground">Nenhuma moeda encontrada.</li>
          ) : (
            list.map((coin) => (
              <li key={coin.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                  onClick={() => pick(coin)}
                >
                  <TokenSymbolAvatar
                    symbol={coin.symbol}
                    coingeckoId={coin.id}
                    iconUrl={coin.image}
                    size={24}
                  />
                  <span className="font-medium">{coin.symbol.toUpperCase()}</span>
                  <span className="truncate text-muted-foreground">{coin.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
