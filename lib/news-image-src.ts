/**
 * URLs de imagem nos cartões de notícias — proxy para evitar bloqueio por referrer/hotlink.
 */

const IMAGE_PROXY = '/api/news/image'

/** Hosts que costumam funcionar sem proxy no browser. */
const DIRECT_HOSTS = new Set([
  'picsum.photos',
  'images.unsplash.com',
  'images.pexels.com',
])

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** URL final para o `<img>` do cartão (proxy quando necessário). */
export function resolveNewsCardImageSrc(url: string | null | undefined): string {
  const s = url?.trim()
  if (!s) return ''
  if (s.startsWith('/') || s.startsWith(`${IMAGE_PROXY}?`)) return s
  if (!isHttpUrl(s)) return s
  try {
    const host = new URL(s).hostname.toLowerCase()
    if (DIRECT_HOSTS.has(host)) return s
    return `${IMAGE_PROXY}?url=${encodeURIComponent(s)}`
  } catch {
    return s
  }
}
