import { Innertube, Platform, UniversalCache } from 'youtubei.js'
import {
  sanitizeYouTubeFilename,
  YOUTUBE_MAX_BYTES,
  YOUTUBE_MAX_DURATION_SEC,
} from '@/lib/cortes-video/youtube'

/** Interpreter necessário para decifrar alguns streams (WEB). */
Platform.shim.eval = async (data: { output: string }) => {
  // eslint-disable-next-line no-new-func
  return new Function(data.output)()
}

type YtClient = 'ANDROID' | 'IOS' | 'TV' | 'MWEB' | 'WEB'

/**
 * ANDROID/IOS primeiro: funcionam melhor em IPs de datacenter
 * e evitam muitos erros de decipher.
 */
const DOWNLOAD_CLIENTS: YtClient[] = ['ANDROID', 'IOS', 'TV', 'MWEB', 'WEB']

export type YoutubeDownloadOk = {
  ok: true
  stream: ReadableStream<Uint8Array>
  title: string
  videoId: string
  duration: number
  filename: string
}

export type YoutubeDownloadFail = {
  ok: false
  status: number
  error: string
  hint?: string
  errors?: string[]
}

export type YoutubeDownloadResult = YoutubeDownloadOk | YoutubeDownloadFail

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

export function mapYouTubeError(message: string): { error: string; status: number } {
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

async function getYt() {
  return Innertube.create({
    cache: new UniversalCache(false),
    generate_session_locally: true,
  })
}

/**
 * Descarrega um vídeo YouTube (stream MP4).
 * Prefer 360p em ambientes serverless / proxy com timeout curto.
 */
export async function downloadYouTubeVideo(
  videoId: string,
  opts?: { preferFastQuality?: boolean },
): Promise<YoutubeDownloadResult> {
  const preferFast = opts?.preferFastQuality ?? Boolean(process.env.VERCEL)
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
          return {
            ok: false,
            status: 400,
            error: 'Lives em directo não são suportadas. Aguarda o vídeo terminar.',
          }
        }

        if (duration > YOUTUBE_MAX_DURATION_SEC) {
          return {
            ok: false,
            status: 400,
            error: `Vídeo demasiado longo (${Math.round(duration / 60)} min). Máx. ${YOUTUBE_MAX_DURATION_SEC / 3600} h — faz upload manual.`,
          }
        }

        const qualityOrder = preferFast
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

            return {
              ok: true,
              stream: limited,
              title,
              videoId,
              duration,
              filename,
            }
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
    const mapped = mapYouTubeError(joined)
    return {
      ok: false,
      status: mapped.status,
      error: mapped.error,
      errors,
      hint: preferFast
        ? 'No hosting o YouTube bloqueia muitos IPs. Usa um proxy (YOUTUBE_PROXY_URL) ou descarrega o MP4 e usa “Seleccionar ficheiro”.'
        : 'Alternativa fiável: descarrega o MP4 no PC e usa “Seleccionar ficheiro”.',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao obter o vídeo do YouTube.'
    const mapped = mapYouTubeError(message)
    return {
      ok: false,
      status: mapped.status,
      error: mapped.error,
      hint: 'Alternativa fiável: descarrega o MP4 no PC e usa “Seleccionar ficheiro”.',
    }
  }
}
