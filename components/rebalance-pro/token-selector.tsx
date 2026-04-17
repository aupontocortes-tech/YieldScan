'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
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

export type TokenOption = {
  id: string
  symbol: string
  name: string
  coingeckoId: string
}

const DEFAULT_TOKENS: TokenOption[] = [
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', coingeckoId: 'ethereum' },
  { id: 'wbtc', symbol: 'WBTC', name: 'Wrapped Bitcoin', coingeckoId: 'wrapped-bitcoin' },
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', coingeckoId: 'bitcoin' },
  { id: 'sol', symbol: 'SOL', name: 'Solana', coingeckoId: 'solana' },
  { id: 'usdc', symbol: 'USDC', name: 'USD Coin', coingeckoId: 'usd-coin' },
  { id: 'usdt', symbol: 'USDT', name: 'Tether', coingeckoId: 'tether' },
  { id: 'arb', symbol: 'ARB', name: 'Arbitrum', coingeckoId: 'arbitrum' },
  { id: 'op', symbol: 'OP', name: 'Optimism', coingeckoId: 'optimism' },
  { id: 'matic', symbol: 'MATIC', name: 'Polygon', coingeckoId: 'matic-network' },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche', coingeckoId: 'avalanche-2' },
]

type TokenSelectorProps = {
  value: TokenOption | null
  onChange: (t: TokenOption) => void
  /** IDs que não podem ser escolhidos (ex.: a outra perna do par). */
  excludeIds?: string[]
  className?: string
}

export function TokenSelector({ value, onChange, excludeIds, className }: TokenSelectorProps) {
  const [open, setOpen] = useState(false)
  const list = useMemo(() => DEFAULT_TOKENS, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-11 w-full justify-between border-white/10 bg-white/5 font-normal text-foreground backdrop-blur-sm hover:bg-white/10',
            className,
          )}
        >
          {value ? (
            <span className="flex items-center gap-2">
              <span className="rounded-md bg-gradient-to-br from-violet-500/20 to-cyan-500/20 px-2 py-0.5 font-mono text-sm font-semibold tracking-tight">
                {value.symbol}
              </span>
              <span className="truncate text-muted-foreground">{value.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Escolha o token…</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] border-white/10 bg-zinc-950/95 p-0 backdrop-blur-xl"
        align="start"
      >
        <Command className="bg-transparent [&_[cmdk-input-wrapper]]:border-white/10">
          <CommandInput placeholder="Procurar token…" className="h-10 border-0 bg-transparent" />
          <CommandList className="max-h-64">
            <CommandEmpty>Nenhum token encontrado.</CommandEmpty>
            <CommandGroup heading="Populares">
              {list.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.symbol} ${t.name} ${t.coingeckoId}`}
                  disabled={excludeIds?.includes(t.id)}
                  onSelect={() => {
                    if (excludeIds?.includes(t.id)) return
                    onChange(t)
                    setOpen(false)
                  }}
                  className="cursor-pointer aria-selected:bg-violet-500/15 data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      value?.id === t.id ? 'opacity-100 text-emerald-400' : 'opacity-0',
                    )}
                  />
                  <span className="font-mono font-semibold">{t.symbol}</span>
                  <span className="ml-2 truncate text-muted-foreground">{t.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { DEFAULT_TOKENS }
