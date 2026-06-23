import { detectMicPlatform, isStandalonePwa } from '@/lib/mic-permission'

/** Gravação mínima para enviar ao Whisper (evita chamada em silêncio). */
export const MIN_AUDIO_BLOB_BYTES = 400

/**
 * PWA instalado no Android: MediaRecorder sem timeslice costuma gerar blob vazio.
 */
export function recordingTimesliceMs(): number | undefined {
  if (isStandalonePwa() || detectMicPlatform() === 'android') return 250
  return undefined
}

export function pickRecorderMimeType(): string | undefined {
  const standalone = isStandalonePwa()
  const android = detectMicPlatform() === 'android'
  const types =
    standalone && android
      ? ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus']
      : android
        ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac']
        : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return undefined
}

export function createAudioRecorder(stream: MediaStream): { recorder: MediaRecorder; mime?: string } {
  const mime = pickRecorderMimeType()
  try {
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    return { recorder, mime }
  } catch {
    return { recorder: new MediaRecorder(stream), mime: undefined }
  }
}

export function isLiveAudioStream(stream: MediaStream): boolean {
  const track = stream.getAudioTracks()[0]
  return !!track && track.readyState === 'live' && track.enabled && !track.muted
}
