import { audioFilenameForMime } from '@/lib/gestao-financeira/audio-mime'
import {
  appendGfOpenAiUsage,
  checkGfOpenAiLimits,
  loadGfOpenAiSettings,
} from '@/lib/gestao-financeira/openai-config'

type TranscribeResponse = {
  text?: string
  usage?: {
    model: string
    durationSeconds: number
    estimatedUsd: number
  }
  error?: string
}

/** Transcreve áudio gravado via OpenAI Whisper (usa a chave local). */
export async function transcribeGfVoiceWithOpenAi(
  audio: Blob,
  durationSeconds: number,
): Promise<{ text: string | null; error: string | null }> {
  const settings = loadGfOpenAiSettings()
  const limit = checkGfOpenAiLimits(settings)
  if (!limit.ok) return { text: null, error: limit.reason }

  try {
    const form = new FormData()
    const filename = audioFilenameForMime(audio.type || 'audio/webm')
    form.append('audio', audio, filename)
    form.append('durationSeconds', String(Math.max(1, Math.round(durationSeconds))))

    const res = await fetch('/api/gestao-financeira/transcribe', {
      method: 'POST',
      headers: { 'X-OpenAI-Key': settings.apiKey.trim() },
      body: form,
    })

    const data = (await res.json()) as TranscribeResponse
    if (!res.ok) {
      return { text: null, error: data.error ?? 'Falha ao transcrever áudio.' }
    }

    if (data.usage) {
      appendGfOpenAiUsage({
        at: new Date().toISOString(),
        feature: 'transcribe',
        model: data.usage.model,
        promptTokens: 0,
        completionTokens: 0,
        estimatedUsd: data.usage.estimatedUsd,
      })
    }

    const text = data.text?.trim()
    if (!text) {
      return { text: null, error: 'Não ouvi nada. Fale mais perto do microfone e tente de novo.' }
    }

    return { text, error: null }
  } catch {
    return { text: null, error: 'Erro de rede ao transcrever áudio.' }
  }
}
