'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildAvatarUrlListFromSymbol } from '@/lib/token-icons'
import { cn } from '@/lib/utils'

/** CDN CoinMarketCap (mesmos assets que o site oficial). */
export function cmcCoinPngUrl(cmcId: number, pixelSize: 64 | 128 = 128): string {
  return `https://s2.coinmarketcap.com/static/img/coins/${pixelSize}x${pixelSize}/${cmcId}.png`
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim())
}

type CoinAvatarProps = {
  cmcId: number
  symbol: string
  /** URL explícita (ex.: thumb CoinGecko). */
  iconUrl?: string | null
  /** Largura/altura em px (usa PNG 128 para ≥40, senão 64). */
  size?: number
  className?: string
}

/**
 * Ordem: iconUrl → CMC 128/64 → ícone por símbolo → iniciais.
 * Vários CDNs bloqueiam hotlink intermitente; fallbacks cobrem a maior parte dos tickers.
 */
export function CoinAvatar({
  cmcId,
  symbol,
  iconUrl,
  size = 32,
  className,
}: CoinAvatarProps) {
  const pngSizes = useMemo<(64 | 128)[]>(() => (size >= 40 ? [128, 64] : [64]), [size])

  const sources = useMemo(() => {
    const list: string[] = []
    const trimmed = iconUrl?.trim()
    if (trimmed && isHttpUrl(trimmed)) list.push(trimmed)
    if (Number.isFinite(cmcId) && cmcId > 0) {
      for (const px of pngSizes) {
        list.push(cmcCoinPngUrl(cmcId, px))
      }
    }
    list.push(...buildAvatarUrlListFromSymbol(symbol))
    return [...new Set(list)]
  }, [cmcId, iconUrl, symbol, pngSizes])

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setAttempt(0)
  }, [cmcId, iconUrl, symbol, size])

  const done = attempt >= sources.length
  const src = !done ? sources[attempt] : ''

  if (done || !src) {
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

  return (
    // eslint-disable-next-line @next/next/no-img-element -- URLs externas; vários domínios
    <img
      src={src}
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
