import { NextResponse } from 'next/server'
import { Innertube, Platform, UniversalCache } from 'youtubei.js'
import {
  parseYouTubeVideoId,
  sanitizeYouTubeFilename,
  YOUTUBE_MAX_BYTES,
  YOUTUBE_MAX_DURATION_SEC,
} from '@/lib/cortes-video/youtube'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

/** Interpreter necessário para decifrar alguns streams. */
Platform.shim.eval = async (data: { output: string }) => {
  // eslint-disable-next-line no-new-func
  return new Function(data.output)()
}

type Body = { url?: string }

async function getYt() {
  return Innertube.create({ cache: new UniversalCache(false) })
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

  try {
    const yt = await getYt()
    // ANDROID costuma devolver formatos muxados (vídeo+áudio num só ficheiro).
    const info = await yt.getBasicInfo(videoId, { client: 'ANDROID' })
    const basic = info.basic_info
    const title = (basic?.title || `youtube-${videoId}`).trim()
    const duration = Number(basic?.duration) || 0

    if (basic?.is_live) {
      return NextResponse.json(
        { error: 'Lives em directo não são suportadas. Aguarda o vídeo terminar.' },
        { status: 400 },
      )
    }

    if (duration > YOUTUBE_MAX_DURATION_SEC) {
      return NextResponse.json(
        {
          error: `Vídeo demasiado longo (${Math.round(duration / 60)} min). Máx. ${YOUTUBE_MAX_DURATION_SEC / 3600} h — descarrega e faz upload manual.`,
        },
        { status: 400 },
      )
    }

    const stream = await yt.download(videoId, {
      client: 'ANDROID',
      type: 'video+audio',
      quality: 'best',
    })

    const chunks: Uint8Array[] = []
    let total = 0
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > YOUTUBE_MAX_BYTES) {
        reader.cancel().catch(() => undefined)
        return NextResponse.json(
          {
            error: `Ficheiro demasiado grande (>${Math.round(YOUTUBE_MAX_BYTES / (1024 * 1024))} MB). Descarrega e faz upload manual.`,
          },
          { status: 400 },
        )
      }
      chunks.push(value)
    }

    if (!total) {
      return NextResponse.json({ error: 'O YouTube devolveu um ficheiro vazio.' }, { status: 502 })
    }

    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)))
    const filename = sanitizeYouTubeFilename(title, videoId)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(buffer.byteLength),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'X-Video-Title': encodeURIComponent(title),
        'X-Video-Id': videoId,
        'X-Video-Duration': String(duration || 0),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao obter o vídeo do YouTube.'
    const known =
      /unavailable|private|age|sign in|login|not available|copyright|members.only/i.test(message)
        ? 'Este vídeo não está disponível para download (privado, idade, membros ou bloqueado).'
        : message.includes('No matching formats')
          ? 'Não foi possível obter um formato com vídeo+áudio. Tenta outro link ou faz upload do ficheiro.'
          : `Não foi possível importar do YouTube: ${message}`

    console.error('[cortes-video/youtube]', videoId, message)
    return NextResponse.json({ error: known }, { status: 502 })
  }
}
