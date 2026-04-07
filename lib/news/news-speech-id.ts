import { normalizarLinkDedupe } from '@/lib/cryptopanic'
import type { NoticiaProcessada } from '@/lib/newsdata'

const PREFIX = 'news-tts-' as const

/** FNV-1a 32-bit → base36 (determinístico, sem IDs aleatórios). */
function fnv1a32(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

/**
 * ID estável para TTS e `news_tts_heard_v1`.
 * Preferência: URL normalizada; sem URL útil → hash de título + fonte.
 */
export function stableNewsSpeechId(n: NoticiaProcessada): string {
  const link = (n.link ?? '').trim()
  const hasRealLink = link.length > 0 && link !== '#'
  if (hasRealLink) {
    const norm = normalizarLinkDedupe(link)
    if (norm.length > 0) return `${PREFIX}${fnv1a32(`u:${norm}`)}`
  }
  const title = (n.titulo ?? '').trim()
  const fonte = (n.fonte ?? '').trim()
  return `${PREFIX}${fnv1a32(`t:${title}\0${fonte}`)}`
}
