import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

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
    return NextResponse.json({ error: 'Áudio vazio.' }, { status: 400 })
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'Áudio demasiado grande (máx. 25 MB).' }, { status: 400 })
  }

  const durationRaw = formData.get('durationSeconds')
  const durationSeconds = Number(durationRaw) > 0 ? Number(durationRaw) : 5
  const costUsd = (durationSeconds / 60) * 0.006

  const filename =
    audio instanceof File && audio.name ? audio.name : 'audio.mp3'

  const openaiForm = new FormData()
  openaiForm.append('file', audio, filename)
  openaiForm.append('model', WHISPER_MODEL)
  openaiForm.append('language', 'pt')
  openaiForm.append('response_format', 'verbose_json')
  openaiForm.append('timestamp_granularities[]', 'word')
  openaiForm.append('timestamp_granularities[]', 'segment')

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: openaiForm,
      signal: AbortSignal.timeout(90_000),
    })

    const data: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const err =
        data && typeof data === 'object' && data !== null && 'error' in data
          ? (data as { error?: { message?: string } }).error?.message
          : null
      return NextResponse.json(
        { error: err || `Whisper falhou (${res.status}).` },
        { status: 502 },
      )
    }

    return NextResponse.json({ transcription: data, costUsd })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro de rede'
    return NextResponse.json({ error: msg }, { status: 504 })
  }
}
