import type {
  CortesCopyPack,
  CortesPlatformId,
  CortesTranscript,
  CutSuggestion,
  TranscriptSegment,
} from '@/lib/cortes-video/types'
import { segmentsToSrt } from '@/lib/cortes-video/srt'
import { openaiHeaders, registerCortesOpenAiCall, loadCortesOpenAiSettings } from '@/lib/cortes-video/openai-config'

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

function parseWhisperToTranscript(raw: unknown): CortesTranscript {
  const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const text = typeof rec.text === 'string' ? rec.text : ''
  const language = typeof rec.language === 'string' ? rec.language : 'pt'
  const segmentsRaw = Array.isArray(rec.segments) ? rec.segments : []
  const segments: TranscriptSegment[] = []

  for (const s of segmentsRaw) {
    if (!s || typeof s !== 'object') continue
    const seg = s as Record<string, unknown>
    const start = Number(seg.start) || 0
    const end = Number(seg.end) || start
    const segText = typeof seg.text === 'string' ? seg.text.trim() : ''
    const wordsRaw = Array.isArray(seg.words) ? seg.words : []
    const words = wordsRaw
      .map((w) => {
        if (!w || typeof w !== 'object') return null
        const wr = w as Record<string, unknown>
        const word = typeof wr.word === 'string' ? wr.word.trim() : ''
        if (!word) return null
        return {
          word,
          start: Number(wr.start) || start,
          end: Number(wr.end) || end,
        }
      })
      .filter(Boolean) as TranscriptSegment['words']

    if (!words.length && segText) {
      const parts = segText.split(/\s+/).filter(Boolean)
      const span = Math.max(0.05, end - start)
      parts.forEach((word, i) => {
        const wStart = start + (span * i) / parts.length
        const wEnd = start + (span * (i + 1)) / parts.length
        words.push({ word, start: wStart, end: wEnd })
      })
    }

    segments.push({
      id: uid('seg'),
      text: segText,
      start,
      end,
      words,
    })
  }

  if (!segments.length && text) {
    segments.push({
      id: uid('seg'),
      text,
      start: 0,
      end: 1,
      words: text.split(/\s+/).filter(Boolean).map((word, i, arr) => ({
        word,
        start: i / Math.max(1, arr.length),
        end: (i + 1) / Math.max(1, arr.length),
      })),
    })
  }

  return {
    text,
    language,
    segments,
    srt: segmentsToSrt(segments),
  }
}

export async function transcribeVideoAudio(audioBlob: Blob, durationSeconds: number): Promise<CortesTranscript> {
  const settings = loadCortesOpenAiSettings()
  const form = new FormData()
  form.append('audio', audioBlob, 'audio.mp3')
  form.append('durationSeconds', String(durationSeconds || 1))

  const res = await fetch('/api/cortes-video/transcribe', {
    method: 'POST',
    headers: openaiHeaders(settings),
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Falha na transcrição.')
  }
  if (typeof data.costUsd === 'number') registerCortesOpenAiCall(data.costUsd)
  return parseWhisperToTranscript(data.transcription ?? data)
}

export async function suggestCuts(transcript: CortesTranscript): Promise<CutSuggestion[]> {
  const settings = loadCortesOpenAiSettings()
  const res = await fetch('/api/cortes-video/suggest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...openaiHeaders(settings),
    },
    body: JSON.stringify({
      text: transcript.text,
      segments: transcript.segments.map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Falha ao sugerir cortes.')
  }
  if (typeof data.costUsd === 'number') registerCortesOpenAiCall(data.costUsd)
  const list = Array.isArray(data.suggestions) ? data.suggestions : []
  return list.map((s: Record<string, unknown>, i: number) => ({
    id: typeof s.id === 'string' ? s.id : uid(`cut${i}`),
    start: Number(s.start) || 0,
    end: Number(s.end) || 0,
    reason: typeof s.reason === 'string' ? s.reason : 'Sugestão',
    score: Number(s.score) || 0.5,
    kind: (['highlight', 'viral', 'silence', 'pause', 'suggested'].includes(String(s.kind))
      ? s.kind
      : 'suggested') as CutSuggestion['kind'],
  }))
}

export async function generateCopy(opts: {
  transcriptText: string
  platformId: CortesPlatformId
}): Promise<CortesCopyPack> {
  const settings = loadCortesOpenAiSettings()
  const res = await fetch('/api/cortes-video/copy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...openaiHeaders(settings),
    },
    body: JSON.stringify(opts),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Falha ao gerar copy.')
  }
  if (typeof data.costUsd === 'number') registerCortesOpenAiCall(data.costUsd)
  return {
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    hashtags: Array.isArray(data.hashtags) ? data.hashtags.map(String) : [],
    summary: String(data.summary ?? ''),
    platformId: opts.platformId,
  }
}

export async function generateCoverIdeas(opts: {
  transcriptText: string
  platformId: CortesPlatformId
  durationSec: number
  generateImage?: boolean
}): Promise<{
  title: string
  subtitle: string
  suggestedTimeSec: number
  imageDataUrl: string | null
}> {
  const settings = loadCortesOpenAiSettings()
  const res = await fetch('/api/cortes-video/cover', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...openaiHeaders(settings),
    },
    body: JSON.stringify(opts),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Falha ao criar capa.')
  }
  if (typeof data.costUsd === 'number') registerCortesOpenAiCall(data.costUsd)
  const b64 = typeof data.imageBase64 === 'string' ? data.imageBase64 : null
  return {
    title: String(data.title ?? 'Capa'),
    subtitle: String(data.subtitle ?? ''),
    suggestedTimeSec: Number(data.suggestedTimeSec) || 0,
    imageDataUrl: b64 ? `data:image/png;base64,${b64}` : null,
  }
}

/** Descarrega um vídeo do YouTube via API do servidor e devolve um File pronto para o fluxo local. */
export async function fetchYouTubeVideoFile(url: string): Promise<File> {
  const res = await fetch('/api/cortes-video/youtube', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  const contentType = res.headers.get('content-type') || ''
  if (!res.ok) {
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}))
      throw new Error(typeof data.error === 'string' ? data.error : 'Falha ao importar do YouTube.')
    }
    throw new Error('Falha ao importar do YouTube.')
  }

  const blob = await res.blob()
  if (!blob.size) throw new Error('O YouTube devolveu um ficheiro vazio.')

  const titleHeader = res.headers.get('X-Video-Title')
  const title = titleHeader ? decodeURIComponent(titleHeader) : 'youtube-video'
  const safeName = `${title.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '').trim().slice(0, 80) || 'youtube-video'}.mp4`

  return new File([blob], safeName, { type: 'video/mp4' })
}
