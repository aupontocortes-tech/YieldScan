'use client'

import type { Pool } from '@/lib/types'
import { tokenPairParts } from '@/lib/token-icons'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import { cn } from '@/lib/utils'

/**
 * Ícones do par: underlying / coingecko, endereços conhecidos, Trust, Uniswap, ticker universal.
 */
export function PairTokenAvatars({ pool, size = 32 }: { pool: Pool; size?: number }) {
  const parts = tokenPairParts(pool.symbol)
  const fallback0 = parts[0] ?? pool.symbol
  const fallback1 = parts[1] ?? parts[0] ?? pool.symbol

  return (
    <div className="flex shrink-0 items-center">
      <TokenSymbolAvatar
        pool={pool}
        poolSlot={0}
        symbol={fallback0}
        size={size}
        className="relative z-10 border-2 border-card"
      />
      <TokenSymbolAvatar
        pool={pool}
        poolSlot={1}
        symbol={fallback1}
        size={size}
        className={cn('relative z-[9] -ml-2.5 border-2 border-card')}
      />
    </div>
  )
}
