/**
 * Ícones guardados ao adicionar favoritos (thumb da pesquisa CoinGecko).
 */

import {
  readHighlightIconMap,
  writeHighlightIconMap,
  type HighlightIconMap,
} from '@/lib/mercado-highlight-icons-store'

export type { HighlightIconMap }

export function readHighlightIconUrl(coinId: string): string | null {
  const id = coinId.trim().toLowerCase()
  if (!id) return null
  return readHighlightIconMap()[id] ?? null
}

export function writeHighlightIconUrl(coinId: string, iconUrl: string | null | undefined): void {
  const id = coinId.trim().toLowerCase()
  const url = iconUrl?.trim()
  if (!id || !url || !url.startsWith('https://')) return
  const map = readHighlightIconMap()
  if (map[id] === url) return
  writeHighlightIconMap({ ...map, [id]: url })
}

export function mergeHighlightIconMaps(...maps: HighlightIconMap[]): HighlightIconMap {
  return Object.assign({}, ...maps)
}
