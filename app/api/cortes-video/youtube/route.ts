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

/** Interpreter necessário para decifrar alguns streams (WEB). */
Platform.shim.eval = async (data: { output: string }) => {
  // eslint-disable-next-line no-new-func
  return new Function(data.output)()
}

type Body = { url?: string }

type YtClient = 'ANDROID' | 'IOS' | 'TV' | 'MWEB' | 'WEB'

/**
 * ANDROID/IOS primeiro: funcionam melhor em IPs de datacenter (Vercel)
 * e evitam muitos erros de decipher que quebram no deploy.
 */
const DOWNLOAD_CLIENTS: YtClient[] = ['ANDROID', 'IOS', 'TV', 'MWEB', 'WEB']

const isVercel = Boolean(process.env.VERCEL)

async function getYt() {
  return Innertube.create({
    cache: new UniversalCache(false),
    /** Sessão local — mais estável em serverless do que pedir tokens a YT. */
    generate_session_locally: true,
  })
}

/**
 * Corta a stream se ultrapassar o limite — sem carregar tudo para RAM
 * (buffer completo rebentava o limite de 4.5 MB do Vercel).
 */
function limitStream(
  source: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  let total = 0
  const reader = source.getReader()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
          return
        }
        if (!value?.byteLength) return
        total += value.byteLength
        if (total > maxBytes) {
          reader.cancel().catch(() => undefined)
          controller.error(
            new Error(
              `Ficheiro demasiado grande (>${Math.round(maxBytes / (1024 * 1024))} MB). Descarrega o vídeo e faz upload manual.`,
            ),
          )
          return
        }
        controller.enqueue(value)
      } catch (err) {
        controller.error(err)
      }
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })
}

function mapYouTubeError(message: string): { error: string; status: number } {
  const m = message.toLowerCase()

  if (/private|members.?only|login|sign in|login required/.test(m)) {
    return {
      status: 403,
      error:
        'Este vídeo é privado ou só para membros. Abre no YouTube, descarrega o ficheiro e faz upload aqui.',
    }
  }
  if (/age|confirm.?your.?age|inappropriate|restricted/.test(m)) {
    return {
      status: 403,
      error:
        'Vídeo com restrição de idade. Faz download no YouTube (conta com idade) e carrega o ficheiro no app.',
    }
  }
  if (/live|premiere/.test(m)) {
    return {
      status: 400,
      error: 'Lives / estreias em directo não são suportadas. Espera o vídeo acabar e tenta de novo.',
    }
  }
  if (/copyright|blocked|not available in your country|geo/.test(m)) {
    return {
      status: 403,
      error:
        'YouTube bloqueou este vídeo (região/copyright). Descarrega noutra ferramenta e faz upload do ficheiro.',
    }
  }
  if (/bot|captcha|unusual traffic|too many requests|rate.?limit|429/.test(m)) {
    return {
      status: 503,
      error:
        'O YouTube está a bloquear o servidor (IP do hosting). Em produção isto é comum — descarrega o MP4 e usa “Seleccionar ficheiro”.',
    }
  }
  if (/no matching formats|decipher|403|status code 4\d\d|payload.?too.?large|413/.test(m)) {
    return {
      status: 502,
      error:
        'O YouTube bloqueou o download automático neste servidor. Solução: descarrega o MP4 e usa “Seleccionar ficheiro”.',
    }
  }
  if (/unavailable|not available/.test(m)) {
    return {
      status: 502,
      error:
        'Não foi possível obter este vídeo pelo link. Confirma que é público; se continuar, faz upload do ficheiro.',
    }
  }

  return {
    status: 502,
    error: `Não foi possível importar do YouTube. Tenta upload do ficheiro. (${message.slice(0, 120)})`,
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

  const errors: string[] = []

  try {
    const yt = await getYt()

    let title = `youtube-${videoId}`
    let duration = 0

    for (const client of DOWNLOAD_CLIENTS) {
      try {
        const info = await yt.getBasicInfo(videoId, { client })
        const basic = info.basic_info
        title = (basic?.title || title).trim()
        duration = Number(basic?.duration) || duration

        const playability = (info as { playability_status?: { status?: string; reason?: string } })
          .playability_status
        if (playability?.status && playability.status !== 'OK') {
          errors.push(`${client}: ${playability.reason || playability.status}`)
          continue
        }

        if (basic?.is_live) {
          return NextResponse.json(
            { error: 'Lives em directo não são suportadas. Aguarda o vídeo terminar.' },
            { status: 400 },
          )
        }

        if (duration > YOUTUBE_MAX_DURATION_SEC) {
          return NextResponse.json(
            {
              error: `Vídeo demasiado longo (${Math.round(duration / 60)} min). Máx. ${YOUTUBE_MAX_DURATION_SEC / 3600} h — faz upload manual.`,
            },
            { status: 400 },
          )
        }

        /**
         * Em Vercel: 360p primeiro (mais rápido, menos timeout).
         * Em local: best primeiro (melhor qualidade).
         */
        const qualityOrder = isVercel
          ? (['360p', 'best'] as const)
          : (['best', '360p'] as const)

        for (const quality of qualityOrder) {
          try {
            const stream = await yt.download(videoId, {
              client,
              type: 'video+audio',
              quality,
            })
            const limited = limitStream(stream, YOUTUBE_MAX_BYTES)
            const filename = sanitizeYouTubeFilename(title, videoId)

            return new NextResponse(limited, {
              status: 200,
              headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
                'X-Video-Title': encodeURIComponent(title),
                'X-Video-Id': videoId,
                'X-Video-Duration': String(duration || 0),
                'X-Accel-Buffering': 'no',
                'Cache-Control': 'no-store',
              },
            })
          } catch (dlErr) {
            const msg = dlErr instanceof Error ? dlErr.message : String(dlErr)
            errors.push(`${client}/${quality}: ${msg}`)
          }
        }
      } catch (infoErr) {
        const msg = infoErr instanceof Error ? infoErr.message : String(infoErr)
        errors.push(`${client}/info: ${msg}`)
      }
    }

    const joined = errors.slice(-3).join(' | ') || 'sem formatos disponíveis'
    console.error('[cortes-video/youtube]', videoId, joined, { vercel: isVercel })
    const mapped = mapYouTubeError(joined)
    return NextResponse.json(
      {
        error: mapped.error,
        hint: isVercel
          ? 'No hosting (Vercel) o YouTube bloqueia muitos IPs. Alternativa fiável: descarrega o MP4 e usa “Seleccionar ficheiro”.'
          : 'Alternativa fiável: descarrega o MP4 no PC e usa “Seleccionar ficheiro”.',
      },
      { status: mapped.status },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao obter o vídeo do YouTube.'
    console.error('[cortes-video/youtube]', videoId, message)
    const mapped = mapYouTubeError(message)
    return NextResponse.json(
      {
        error: mapped.error,
        hint: 'Alternativa fiável: descarrega o MP4 no PC e usa “Seleccionar ficheiro”.',
      },
      { status: mapped.status },
    )
  }
}
