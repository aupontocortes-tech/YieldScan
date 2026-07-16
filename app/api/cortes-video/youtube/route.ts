import { NextResponse } from 'next/server'
import { parseYouTubeVideoId } from '@/lib/cortes-video/youtube'
import { downloadYouTubeVideo } from '@/lib/cortes-video/youtube-download'
import { fetchYouTubeViaProxy, getYoutubeProxyConfig } from '@/lib/cortes-video/youtube-proxy'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

type Body = { url?: string }

const isVercel = Boolean(process.env.VERCEL)

function videoResponse(opts: {
  body: ReadableStream<Uint8Array> | Blob | ArrayBuffer | null
  filename: string
  title: string
  videoId: string
  duration: string
}): NextResponse {
  return new NextResponse(opts.body, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(opts.filename)}`,
      'X-Video-Title': encodeURIComponent(opts.title),
      'X-Video-Id': opts.videoId,
      'X-Video-Duration': opts.duration,
      'X-Accel-Buffering': 'no',
      'Cache-Control': 'no-store',
    },
  })
}

/** Se YOUTUBE_PROXY_URL estiver definido, descarrega no VPS/proxy em vez do IP da Vercel. */
async function tryProxyDownload(youtubeUrl: string, videoId: string): Promise<NextResponse | null> {
  const proxy = getYoutubeProxyConfig()
  if (!proxy) return null

  try {
    const res = await fetchYouTubeViaProxy(youtubeUrl, proxy)
    const contentType = res.headers.get('content-type') || ''

    if (!res.ok) {
      let error = 'O proxy YouTube falhou.'
      let hint: string | undefined
      if (contentType.includes('application/json')) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
          hint?: string
        } | null
        if (data?.error) error = data.error
        if (data?.hint) hint = data.hint
      } else {
        const text = await res.text().catch(() => '')
        if (text) error = text.slice(0, 200)
      }
      console.error('[cortes-video/youtube] proxy fail', videoId, res.status, error)
      return NextResponse.json(
        {
          error,
          hint:
            hint ||
            'Confirma que o proxy (YOUTUBE_PROXY_URL) está ligado. Alternativa: descarrega o MP4 e usa “Seleccionar ficheiro”.',
        },
        { status: res.status >= 400 && res.status < 600 ? res.status : 502 },
      )
    }

    if (!res.body) {
      return NextResponse.json(
        { error: 'O proxy devolveu uma resposta vazia.', hint: 'Reinicia o servidor proxy e tenta de novo.' },
        { status: 502 },
      )
    }

    const titleHeader = res.headers.get('x-video-title') || encodeURIComponent(`youtube-${videoId}`)
    const durationHeader = res.headers.get('x-video-duration') || '0'
    const disposition = res.headers.get('content-disposition')
    let filename = `youtube-${videoId}.mp4`
    const m = disposition?.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i)
    if (m) {
      try {
        filename = decodeURIComponent(m[1] || m[2] || filename)
      } catch {
        filename = m[1] || m[2] || filename
      }
    }

    let title = `youtube-${videoId}`
    try {
      title = decodeURIComponent(titleHeader)
    } catch {
      title = titleHeader
    }

    return videoResponse({
      body: res.body,
      filename,
      title,
      videoId,
      duration: durationHeader,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cortes-video/youtube] proxy unreachable', videoId, message)
    return NextResponse.json(
      {
        error: 'Não foi possível contactar o proxy YouTube (YOUTUBE_PROXY_URL).',
        hint: 'Verifica se o VPS está ligado e a URL/secret estão correctos na Vercel. Alternativa: upload do MP4.',
      },
      { status: 503 },
    )
  }
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  const videoId = parseYouTubeVideoId(url)
  if (!videoId) {
    return NextResponse.json(
      { error: 'URL do YouTube inválida. Usa youtube.com/watch?v=… ou youtu.be/…' },
      { status: 400 },
    )
  }

  // 1) Proxy externo (recomendado em produção)
  const proxied = await tryProxyDownload(url, videoId)
  if (proxied) return proxied

  // 2) Download directo neste servidor (ok em localhost; frágil na Vercel)
  const result = await downloadYouTubeVideo(videoId, { preferFastQuality: isVercel })

  if (!result.ok) {
    console.error('[cortes-video/youtube]', videoId, result.errors?.slice(-3) || result.error, {
      vercel: isVercel,
    })
    return NextResponse.json(
      {
        error: result.error,
        hint:
          result.hint ||
          (isVercel
            ? 'Configura YOUTUBE_PROXY_URL (VPS) ou descarrega o MP4 e usa “Seleccionar ficheiro”.'
            : 'Alternativa fiável: descarrega o MP4 no PC e usa “Seleccionar ficheiro”.'),
      },
      { status: result.status },
    )
  }

  return videoResponse({
    body: result.stream,
    filename: result.filename,
    title: result.title,
    videoId: result.videoId,
    duration: String(result.duration || 0),
  })
}
