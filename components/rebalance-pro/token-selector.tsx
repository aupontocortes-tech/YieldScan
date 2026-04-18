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
  { id: 'dai', symbol: 'DAI', name: 'Dai', coingeckoId: 'dai' },
  { id: 'arb', symbol: 'ARB', name: 'Arbitrum', coingeckoId: 'arbitrum' },
  { id: 'op', symbol: 'OP', name: 'Optimism', coingeckoId: 'optimism' },
  { id: 'matic', symbol: 'MATIC', name: 'Polygon', coingeckoId: 'matic-network' },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche', coingeckoId: 'avalanche-2' },
  { id: 'aave', symbol: 'AAVE', name: 'Aave', coingeckoId: 'aave' },
  { id: 'ada', symbol: 'ADA', name: 'Cardano', coingeckoId: 'cardano' },
  { id: 'algo', symbol: 'ALGO', name: 'Algorand', coingeckoId: 'algorand' },
  { id: 'apt', symbol: 'APT', name: 'Aptos', coingeckoId: 'aptos' },
  { id: 'atom', symbol: 'ATOM', name: 'Cosmos Hub', coingeckoId: 'cosmos' },
  { id: 'bch', symbol: 'BCH', name: 'Bitcoin Cash', coingeckoId: 'bitcoin-cash' },
  { id: 'bnb', symbol: 'BNB', name: 'BNB', coingeckoId: 'binancecoin' },
  { id: 'bonk', symbol: 'BONK', name: 'Bonk', coingeckoId: 'bonk' },
  { id: 'cro', symbol: 'CRO', name: 'Cronos', coingeckoId: 'crypto-com-chain' },
  { id: 'crv', symbol: 'CRV', name: 'Curve DAO', coingeckoId: 'curve-dao-token' },
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', coingeckoId: 'dogecoin' },
  { id: 'dot', symbol: 'DOT', name: 'Polkadot', coingeckoId: 'polkadot' },
  { id: 'egld', symbol: 'EGLD', name: 'MultiversX', coingeckoId: 'multiversx' },
  { id: 'etc', symbol: 'ETC', name: 'Ethereum Classic', coingeckoId: 'ethereum-classic' },
  { id: 'ens', symbol: 'ENS', name: 'Ethereum Name Service', coingeckoId: 'ethereum-name-service' },
  { id: 'fdusd', symbol: 'FDUSD', name: 'First Digital USD', coingeckoId: 'first-digital-usd' },
  { id: 'fet', symbol: 'FET', name: 'Artificial Superintelligence Alliance', coingeckoId: 'fetch-ai' },
  { id: 'fil', symbol: 'FIL', name: 'Filecoin', coingeckoId: 'filecoin' },
  { id: 'flow', symbol: 'FLOW', name: 'Flow', coingeckoId: 'flow' },
  { id: 'grt', symbol: 'GRT', name: 'The Graph', coingeckoId: 'the-graph' },
  { id: 'hbar', symbol: 'HBAR', name: 'Hedera', coingeckoId: 'hedera-hashgraph' },
  { id: 'icp', symbol: 'ICP', name: 'Internet Computer', coingeckoId: 'internet-computer' },
  { id: 'imx', symbol: 'IMX', name: 'Immutable', coingeckoId: 'immutable-x' },
  { id: 'inj', symbol: 'INJ', name: 'Injective', coingeckoId: 'injective-protocol' },
  { id: 'jup', symbol: 'JUP', name: 'Jupiter', coingeckoId: 'jupiter-exchange-solana' },
  { id: 'kas', symbol: 'KAS', name: 'Kaspa', coingeckoId: 'kaspa' },
  { id: 'ldo', symbol: 'LDO', name: 'Lido DAO', coingeckoId: 'lido-dao' },
  { id: 'link', symbol: 'LINK', name: 'Chainlink', coingeckoId: 'chainlink' },
  { id: 'ltc', symbol: 'LTC', name: 'Litecoin', coingeckoId: 'litecoin' },
  { id: 'mnt', symbol: 'MNT', name: 'Mantle', coingeckoId: 'mantle' },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol', coingeckoId: 'near' },
  { id: 'ondo', symbol: 'ONDO', name: 'Ondo', coingeckoId: 'ondo-finance' },
  { id: 'paxg', symbol: 'PAXG', name: 'PAX Gold', coingeckoId: 'pax-gold' },
  { id: 'pendle', symbol: 'PENDLE', name: 'Pendle', coingeckoId: 'pendle' },
  { id: 'pepe', symbol: 'PEPE', name: 'Pepe', coingeckoId: 'pepe' },
  { id: 'pol', symbol: 'POL', name: 'Polygon Ecosystem Token', coingeckoId: 'polygon-ecosystem-token' },
  { id: 'pyusd', symbol: 'PYUSD', name: 'PayPal USD', coingeckoId: 'paypal-usd' },
  { id: 'render', symbol: 'RENDER', name: 'Render', coingeckoId: 'render-token' },
  { id: 'rune', symbol: 'RUNE', name: 'THORChain', coingeckoId: 'thorchain' },
  { id: 'sei', symbol: 'SEI', name: 'Sei', coingeckoId: 'sei-network' },
  { id: 'shib', symbol: 'SHIB', name: 'Shiba Inu', coingeckoId: 'shiba-inu' },
  { id: 'stx', symbol: 'STX', name: 'Stacks', coingeckoId: 'stacks' },
  { id: 'steth', symbol: 'stETH', name: 'Lido Staked Ether', coingeckoId: 'staked-ether' },
  { id: 'sui', symbol: 'SUI', name: 'Sui', coingeckoId: 'sui' },
  { id: 'tao', symbol: 'TAO', name: 'Bittensor', coingeckoId: 'bittensor' },
  { id: 'tia', symbol: 'TIA', name: 'Celestia', coingeckoId: 'celestia' },
  { id: 'ton', symbol: 'TON', name: 'Toncoin', coingeckoId: 'the-open-network' },
  { id: 'trx', symbol: 'TRX', name: 'TRON', coingeckoId: 'tron' },
  { id: 'uni', symbol: 'UNI', name: 'Uniswap', coingeckoId: 'uniswap' },
  { id: 'vet', symbol: 'VET', name: 'VeChain', coingeckoId: 'vechain' },
  { id: 'wif', symbol: 'WIF', name: 'dogwifhat', coingeckoId: 'dogwifcoin' },
  { id: 'xlm', symbol: 'XLM', name: 'Stellar', coingeckoId: 'stellar' },
  { id: 'xmr', symbol: 'XMR', name: 'Monero', coingeckoId: 'monero' },
  { id: 'xrp', symbol: 'XRP', name: 'XRP', coingeckoId: 'ripple' },
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
          <CommandList className="max-h-[min(24rem,55vh)]">
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
