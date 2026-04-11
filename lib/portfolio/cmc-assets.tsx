'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

/** CDN CoinMarketCap (mesmos assets que o site oficial). */
export function cmcCoinPngUrl(cmcId: number, pixelSize: 64 | 128 = 128): string {
  return `https://s2.coinmarketcap.com/static/img/coins/${pixelSize}x${pixelSize}/${cmcId}.png`
}

type CoinAvatarProps = {
  cmcId: number
  symbol: string
  /** Largura/altura em px (usa PNG 128 para ≥40, senão 64). */
  size?: number
  className?: string
}

/**
 * Tenta 128 → 64 → iniciais. `referrerPolicy` reduz bloqueios de hotlink em alguns browsers.
 */
export function CoinAvatar({ cmcId, symbol, size = 32, className }: CoinAvatarProps) {
  const pngSizes = useMemo<(64 | 128)[]>(() => (size >= 40 ? [128, 64] : [64]), [size])
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setAttempt(0)
  }, [cmcId])

  const doneImages = attempt >= pngSizes.length

  if (!Number.isFinite(cmcId) || cmcId <= 0 || doneImages) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-[#1e2329] font-semibold uppercase text-muted-foreground ring-1 ring-white/10',
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.max(9, size * 0.32) }}
      >
        {(symbol || '?').slice(0, 2)}
      </div>
    )
  }

  const px = pngSizes[Math.min(attempt, pngSizes.length - 1)]!
  const url = cmcCoinPngUrl(cmcId, px)

  return (
    // eslint-disable-next-line @next/next/no-img-element -- URLs externas CMC; domínio não configurado em next/image
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={cn(
        'shrink-0 rounded-full bg-[#1e2329] object-cover ring-1 ring-white/10',
        className,
      )}
      onError={() => setAttempt((a) => a + 1)}
    />
  )
}
