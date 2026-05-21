'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Pool } from '@/lib/types'
import {
  buildAvatarUrlList,
  buildAvatarUrlListFromSymbol,
  symbolToInitials,
} from '@/lib/token-icons'
import { cn } from '@/lib/utils'

type TokenSymbolAvatarProps = {
  symbol: string
  chain?: string
  coingeckoId?: string
  iconUrl?: string | null
  pool?: Pool
  /** Índice do token no par quando `pool` está definido (0 ou 1). */
  poolSlot?: 0 | 1
  size?: number
  className?: string
  title?: string
}

/**
 * Avatar circular com fallbacks em cadeia (API, endereço, CoinGecko, ícone por ticker).
 */
export function TokenSymbolAvatar({
  symbol,
  chain,
  coingeckoId,
  iconUrl,
  pool,
  poolSlot = 0,
  size = 32,
  className,
  title,
}: TokenSymbolAvatarProps) {
  const urls = useMemo(() => {
    if (pool) return buildAvatarUrlList(pool, poolSlot)
    return buildAvatarUrlListFromSymbol(symbol, { chain, coingeckoId, iconUrl })
  }, [pool, poolSlot, symbol, chain, coingeckoId, iconUrl])

  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [urls])

  const showImage = urls.length > 0 && index < urls.length
  const initials = symbolToInitials(symbol)
  const px = `${size}px`

  if (showImage) {
    return (
      <img
        src={urls[index]}
        alt=""
        width={size}
        height={size}
        title={title ?? symbol}
        className={cn('shrink-0 rounded-full border border-card/80 bg-secondary object-cover', className)}
        style={{ width: px, height: px }}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setIndex((i) => i + 1)}
      />
    )
  }

  return (
    <span
      title={title ?? symbol}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-card/80 bg-secondary font-bold uppercase text-foreground',
        className,
      )}
      style={{ width: px, height: px, fontSize: Math.max(9, size * 0.32) }}
    >
      {initials}
    </span>
  )
}
