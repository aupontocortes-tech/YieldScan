'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import { useUnlocksStore } from '@/store/unlocks-store'
import { pushUnlocksRecent, readUnlocksRecent, type UnlocksRecentCoin } from '@/lib/unlocks-recent'

type SearchHit = { id: string; name: string; symbol: string; image?: string }

async function searchCoins(q: string): Promise<SearchHit[]> {
  const res = await fetch(`/api/coingecko/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) return []
  const body = (await res.json()) as { coins?: SearchHit[] }
  return body.coins ?? []
}

export function UnlocksTokenPicker() {
  const search = useUnlocksStore((s) => s.search)
  const setSearch = useUnlocksStore((s) => s.setSearch)
  const addExtraGeckoId = useUnlocksStore((s) => s.addExtraGeckoId)
  const [open, setOpen] = useState(false)
  const [debounced, setDebounced] = useState(search)
  const [recent, setRecent] = useState<UnlocksRecentCoin[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setRecent(readUnlocksRecent())
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 200)
    return () => clearTimeout(t)
  }, [search])

  const { data: hits = [] } = useQuery({
    queryKey: ['unlocks-coin-search', debounced],
    queryFn: () => searchCoins(debounced),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  })

  const pick = useCallback(
    (coin: SearchHit) => {
      addExtraGeckoId(coin.id)
      setSearch(coin.symbol.toUpperCase())
      pushUnlocksRecent({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
      })
      setRecent(readUnlocksRecent())
      setOpen(false)
    },
    [addExtraGeckoId, setSearch]
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && hits[0]) {
      e.preventDefault()
      pick(hits[0])
    }
    if (e.key === 'Escape') setOpen(false)
  }

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const showDropdown = open && (debounced.length >= 2 ? hits.length > 0 : recent.length > 0)

  return (
    <div ref={wrapRef} className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Pesquisar moeda… Enter"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-9 bg-muted/25 pl-9"
      />
      {showDropdown && (
        <ul
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover py-1 shadow-lg"
          role="listbox"
        >
          {debounced.length < 2 && recent.length > 0 && (
            <li className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Recentes
            </li>
          )}
          {debounced.length < 2 &&
            recent.map((coin) => (
              <li key={`r-${coin.id}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                  onClick={() =>
                    pick({ id: coin.id, name: coin.name, symbol: coin.symbol })
                  }
                >
                  <TokenSymbolAvatar symbol={coin.symbol} coingeckoId={coin.id} size={22} />
                  <span className="font-medium">{coin.symbol}</span>
                  <span className="truncate text-muted-foreground">{coin.name}</span>
                </button>
              </li>
            ))}
          {debounced.length >= 2 &&
            hits.map((coin) => (
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
                    size={22}
                  />
                  <span className="font-medium">{coin.symbol.toUpperCase()}</span>
                  <span className="truncate text-muted-foreground">{coin.name}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
