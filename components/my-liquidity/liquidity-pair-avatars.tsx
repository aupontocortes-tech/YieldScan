'use client'

import type { LiquidityChain } from '@/lib/liquidity/types'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import { cn } from '@/lib/utils'

/** Logos CoinGecko/Uniswap seguem “Ethereum” para tokens EVM. */
function avatarChainKey(chain: LiquidityChain): 'Ethereum' | 'Solana' {
  if (chain === 'solana') return 'Solana'
  return 'Ethereum'
}

export function LiquidityPairAvatars({
  chain,
  symbolA,
  symbolB,
}: {
  chain: LiquidityChain
  symbolA: string
  symbolB: string
}) {
  const c = avatarChainKey(chain)

  return (
    <div className="flex shrink-0 items-center">
      <TokenSymbolAvatar symbol={symbolA} chain={c} size={40} className="relative z-10 border-2 border-card" />
      <TokenSymbolAvatar
        symbol={symbolB}
        chain={c}
        size={40}
        className={cn('relative z-[9] -ml-2.5 border-2 border-card')}
      />
    </div>
  )
}
