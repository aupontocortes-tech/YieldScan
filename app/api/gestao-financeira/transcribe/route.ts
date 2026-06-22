import { NextResponse } from 'next/server'
import { audioFilenameForMime } from '@/lib/gestao-financeira/audio-mime'
import { estimateWhisperCostUsd } from '@/lib/gestao-financeira/openai-config'

export const runtime = 'nodejs'

const WHISPER_MODEL = 'whisper-1'

function resolveKey(req: Request): string | null {
  const header = req.headers.get('x-openai-key')?.trim()
  if (header) return header
  return process.env.OPENAI_API_KEY?.trim() || null
}

export async function POST(req: Request) {
  const key = resolveKey(req)
  if (!key) {
    return NextResponse.json({ error: 'Chave OpenAI não configurada.' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Áudio inválido.' }, { status: 400 })
  }

  const audio = formData.get('audio')
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: 'Gravação vazia.' }, { status: 400 })
  }

  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'Áudio muito longo (máx. ~25 MB).' }, { status: 400 })
  }

  const durationRaw = formData.get('durationSeconds')
  const durationSeconds = Number(durationRaw) > 0 ? Number(durationRaw) : 5

  const audioType = audio.type || 'audio/webm'
  const filename =
    audio instanceof File && audio.name
      ? audio.name
      : audioFilenameForMime(audioType)

  const openaiForm = new FormData()
  openaiForm.append('file', audio, filename)
  openaiForm.append('model', WHISPER_MODEL)
  openaiForm.append('language', 'pt')
  openaiForm.append('response_format', 'json')

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: openaiForm,
      signal: AbortSignal.timeout(45_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      if (res.status === 401) {
        return NextResponse.json({ error: 'Chave OpenAI inválida.' }, { status: 401 })
      }
      return NextResponse.json(
        { error: `Whisper respondeu ${res.status}. ${errText.slice(0, 120)}` },
        { status: 502 },
      )
    }

    const json = (await res.json()) as { text?: string }
    const text = json.text?.trim() ?? ''
    const estimatedUsd = estimateWhisperCostUsd(durationSeconds)

    return NextResponse.json({
      text,
      usage: { model: WHISPER_MODEL, durationSeconds, estimatedUsd },
    })
  } catch {
    return NextResponse.json({ error: 'Timeout ou falha ao contactar Whisper.' }, { status: 504 })
  }
}
