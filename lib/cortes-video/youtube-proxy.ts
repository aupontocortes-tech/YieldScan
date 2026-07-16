/**
 * Proxy opcional para download YouTube fora da Vercel.
 *
 * No Vercel: define YOUTUBE_PROXY_URL (+ YOUTUBE_PROXY_SECRET) apontando
 * para o servidor em scripts/youtube-proxy-server.mjs (VPS / PC em casa).
 */

export type YoutubeProxyConfig = {
  /** Base URL sem barra final, ex. https://yt.teu-dominio.com */
  baseUrl: string
  secret: string | null
}

export function getYoutubeProxyConfig(): YoutubeProxyConfig | null {
  const raw = process.env.YOUTUBE_PROXY_URL?.trim()
  if (!raw) return null

  let baseUrl = raw.replace(/\/+$/, '')
  // Aceitar URL com path /download já incluído
  if (baseUrl.toLowerCase().endsWith('/download')) {
    baseUrl = baseUrl.slice(0, -'/download'.length).replace(/\/+$/, '')
  }

  try {
    // Validar URL
    // eslint-disable-next-line no-new
    new URL(baseUrl)
  } catch {
    console.error('[youtube-proxy] YOUTUBE_PROXY_URL inválida:', raw)
    return null
  }

  const secret = process.env.YOUTUBE_PROXY_SECRET?.trim() || null
  return { baseUrl, secret }
}

/** Reencaminha o pedido de download para o proxy externo e devolve a Response. */
export async function fetchYouTubeViaProxy(
  youtubeUrl: string,
  config: YoutubeProxyConfig,
): Promise<Response> {
  const endpoint = `${config.baseUrl}/download`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'video/mp4, application/json',
  }
  if (config.secret) {
    headers.Authorization = `Bearer ${config.secret}`
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url: youtubeUrl }),
    // Não cachear; stream longo
    cache: 'no-store',
  })

  return res
}
