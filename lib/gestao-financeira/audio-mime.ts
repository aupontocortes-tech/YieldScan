/** Extensão de ficheiro aceite pelo Whisper a partir do MIME gravado. */
export function audioFilenameForMime(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'gravacao.m4a'
  if (m.includes('mpeg') || m.includes('mp3')) return 'gravacao.mp3'
  if (m.includes('ogg')) return 'gravacao.ogg'
  if (m.includes('wav')) return 'gravacao.wav'
  return 'gravacao.webm'
}
