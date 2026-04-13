'use client'

import { useMemo, useState } from 'react'
import { buildAvatarUrlListFromPairSymbols, symbolToInitials } from '@/lib/token-icons'
import type { LiquidityChain } from '@/lib/liquidity/types'
import { cn } from '@/lib/utils'

/** Logos CoinGecko/Uniswap seguem “Ethereum” para tokens EVM. */
function avatarChainKey(chain: LiquidityChain): 'Ethereum' | 'Solana' {
  if (chain === 'solana') return 'Solana'
  return 'Ethereum'
}

function TokenAvatarSlot({
  urls,
  symbolFallback,
  overlapClass,
  zIndex,
  className,
}: {
  urls: string[]
  symbolFallback: string
  overlapClass: string
  zIndex: number
  className?: string
}) {
  const [index, setIndex] = useState(0)
  const showImage = urls.length > 0 && index < urls.length
  const initials = symbolToInitials(symbolFallback)

  if (showImage) {
    return (
      <img
        src={urls[index]}
        alt=""
        width={40}
        height={40}
        className={cn(
          'h-10 w-10 rounded-full border-2 border-card object-cover bg-secondary',
          overlapClass,
          className,
        )}
        style={{ zIndex }}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setIndex((i) => i + 1)}
      />
    )
  }

  return (
    <span
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full border-2 border-card bg-secondary text-xs font-bold uppercase text-foreground',
        overlapClass,
        className,
      )}
      style={{ zIndex }}
      title={symbolFallback}
    >
      {initials}
    </span>
  )
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
  const urls0 = useMemo(
    () => buildAvatarUrlListFromPairSymbols(c, symbolA, symbolB, 0),
    [c, symbolA, symbolB],
  )
  const urls1 = useMemo(
    () => buildAvatarUrlListFromPairSymbols(c, symbolA, symbolB, 1),
    [c, symbolA, symbolB],
  )

  return (
    <div className="flex shrink-0 items-center">
      <TokenAvatarSlot urls={urls0} symbolFallback={symbolA} overlapClass="" zIndex={10} />
      <TokenAvatarSlot
        urls={urls1}
        symbolFallback={symbolB}
        overlapClass="-ml-2.5"
        zIndex={9}
      />
    </div>
  )
}
