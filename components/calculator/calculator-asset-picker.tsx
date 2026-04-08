'use client'

import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Coins, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  buildCoinAsset,
  buildVsAsset,
  type CalculatorAsset,
} from '@/lib/calculator/assets'
import { cn } from '@/lib/utils'

type Mode = 'coin' | 'vs'

const POPULAR_VS = [
  'usd',
  'brl',
  'eur',
  'gbp',
  'btc',
  'eth',
  'sol',
  'jpy',
  'chf',
  'cad',
  'aud',
  'mxn',
  'ars',
  'clp',
  'cop',
]

function sortVsCodes(list: string[]): string[] {
  const set = new Set(list)
  const head = POPULAR_VS.filter((c) => set.has(c))
  const tail = [...list].filter((c) => !POPULAR_VS.includes(c)).sort((a, b) => a.localeCompare(b))
  return [...head, ...tail]
}

async function fetchCoinSearch(q: string): Promise<CalculatorAsset[]> {
  const res = await fetch(`/api/coingecko/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('search')
  const j = (await res.json()) as {
    coins?: Array<{ id: string; name: string; symbol: string }>
  }
  const coins = Array.isArray(j.coins) ? j.coins : []
  return coins.map((c) => buildCoinAsset(c))
}

async function fetchVsCurrencies(): Promise<string[]> {
  const res = await fetch('/api/coingecko/vs-currencies')
  if (!res.ok) return ['usd', 'brl', 'eur']
  const j = (await res.json()) as { currencies?: string[] }
  return Array.isArray(j.currencies) ? j.currencies : []
}

type Props = {
  mode: Mode
  value: CalculatorAsset
  onChange: (asset: CalculatorAsset) => void
  disabled?: boolean
  className?: string
}

export function CalculatorAssetPicker({ mode, value, onChange, disabled, className }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!open) {
      setSearch('')
      setDebounced('')
    }
  }, [open])

  const {
    data: coinResults = [],
    isFetching: coinLoading,
    isError: coinError,
  } = useQuery({
    queryKey: ['coingecko-search-calculator', debounced],
    queryFn: () => fetchCoinSearch(debounced),
    enabled: open && mode === 'coin' && debounced.length >= 2,
    staleTime: 60_000,
    gcTime: 300_000,
  })

  const { data: vsList = [] } = useQuery({
    queryKey: ['coingecko-vs-currencies'],
    queryFn: fetchVsCurrencies,
    staleTime: 3_600_000,
    gcTime: 7_200_000,
    enabled: open && mode === 'vs',
  })

  const vsSorted = useMemo(() => sortVsCodes(vsList), [vsList])

  const vsAssets = useMemo(
    () => vsSorted.map((code) => buildVsAsset(code)),
    [vsSorted]
  )

  const handlePick = (asset: CalculatorAsset) => {
    onChange(asset)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-11 w-full justify-between border-border bg-secondary font-medium sm:w-[260px]',
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Coins className="size-4 shrink-0 opacity-70" />
            <span className="truncate text-left">{value.label}</span>
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(100vw-2rem),320px)] p-0 sm:w-[300px]"
        align="start"
        data-no-swipe-nav
      >
        {mode === 'coin' ? (
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type coin name or ticker…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {debounced.length < 2 ? (
                <CommandEmpty className="py-6 text-xs text-muted-foreground">
                  Type at least 2 characters to search CoinGecko.
                </CommandEmpty>
              ) : coinLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Searching…
                </div>
              ) : coinError ? (
                <CommandEmpty>Search failed. Try again.</CommandEmpty>
              ) : coinResults.length === 0 ? (
                <CommandEmpty>No coins found.</CommandEmpty>
              ) : (
                <CommandGroup heading="Coins">
                  {coinResults.map((a) => (
                    <CommandItem key={a.id} value={`${a.id} ${a.name} ${a.symbol}`} onSelect={() => handlePick(a)}>
                      <Check
                        className={cn(
                          'size-4 shrink-0',
                          value.id === a.id && value.type === 'crypto' ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="min-w-0 truncate">{a.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        ) : (
          <Command>
            <CommandInput placeholder="Type currency code (USD, EUR, BTC…)…" />
            <CommandList>
              <CommandEmpty>No matching quote currency.</CommandEmpty>
              <CommandGroup heading="Quote currencies (CoinGecko)">
                {vsAssets.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={`${a.id} ${a.symbol} ${a.name}`}
                    onSelect={() => handlePick(a)}
                  >
                    <Check
                      className={cn(
                        'size-4 shrink-0',
                        value.id === a.id && value.type === 'fiat' ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="min-w-0 truncate">{a.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  )
}
