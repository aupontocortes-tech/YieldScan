/** Helpers YouTube para Cortes de Vídeo (parse de URL + limites). */

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

/** Limite prático para o PC / FFmpeg.wasm no browser. */
export const YOUTUBE_MAX_DURATION_SEC = 3 * 60 * 60 // 3 h
export const YOUTUBE_MAX_BYTES = 450 * 1024 * 1024 // ~450 MB

export function parseYouTubeVideoId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  // ID directo (11 chars típicos)
  if (/^[\w-]{11}$/.test(raw)) return raw

  let url: URL
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  if (!YOUTUBE_HOSTS.has(host) && !host.endsWith('.youtube.com')) return null

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0]
    return id && /^[\w-]{11}$/.test(id) ? id : null
  }

  const v = url.searchParams.get('v')
  if (v && /^[\w-]{11}$/.test(v)) return v

  const parts = url.pathname.split('/').filter(Boolean)
  // /shorts/ID, /embed/ID, /live/ID, /v/ID
  const marker = parts.findIndex((p) => ['shorts', 'embed', 'live', 'v', 'watch'].includes(p))
  if (marker >= 0 && parts[marker] !== 'watch') {
    const id = parts[marker + 1]
    if (id && /^[\w-]{11}$/.test(id)) return id
  }

  return null
}

export function isYouTubeUrl(input: string): boolean {
  return Boolean(parseYouTubeVideoId(input))
}

export function sanitizeYouTubeFilename(title: string, videoId: string): string {
  const base = (title || `youtube-${videoId}`)
    .normalize('NFKD')
    .replace(/[^\w\s\-àáâãäåæçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ().]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  const safe = base || `youtube-${videoId}`
  return `${safe}.mp4`
}
