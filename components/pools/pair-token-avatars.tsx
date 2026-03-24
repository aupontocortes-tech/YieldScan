'use client'

import { useMemo, useState } from 'react'
import type { Pool } from '@/lib/types'
import { buildAvatarUrlList, symbolToInitials, tokenPairParts } from '@/lib/token-icons'
import { cn } from '@/lib/utils'

function TokenAvatarSlot({
  urls,
  symbolFallback,
  overlapClass,
  zIndex,
}: {
  urls: string[]
  symbolFallback: string
  overlapClass: string
  zIndex: number
}) {
  const [index, setIndex] = useState(0)

  const showImage = urls.length > 0 && index < urls.length
  const initials = symbolToInitials(symbolFallback)

  if (showImage) {
    return (
      <img
        src={urls[index]}
        alt=""
        width={32}
        height={32}
        className={cn(
          'h-8 w-8 rounded-full border-2 border-card object-cover bg-secondary',
          overlapClass
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
        'flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] font-bold uppercase text-foreground',
        overlapClass
      )}
      style={{ zIndex }}
      title={symbolFallback}
    >
      {initials}
    </span>
  )
}

/**
 * Ícones: underlying / coingecko: da DefiLlama, endereços conhecidos por chain+símbolo,
 * Trust Wallet, Uniswap assets, 1inch (ETH), logos CoinGecko por ticker.
 */
export function PairTokenAvatars({ pool }: { pool: Pool }) {
  const parts = tokenPairParts(pool.symbol)
  const fallback0 = parts[0] ?? pool.symbol
  const fallback1 = parts[1] ?? parts[0] ?? pool.symbol

  const urls0 = useMemo(() => buildAvatarUrlList(pool, 0), [pool])
  const urls1 = useMemo(() => buildAvatarUrlList(pool, 1), [pool])

  return (
    <div className="flex shrink-0 items-center">
      <TokenAvatarSlot urls={urls0} symbolFallback={fallback0} overlapClass="" zIndex={10} />
      <TokenAvatarSlot urls={urls1} symbolFallback={fallback1} overlapClass="-ml-2.5" zIndex={9} />
    </div>
  )
}
