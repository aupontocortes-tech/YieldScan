export const GF_VOICE_EVENT = 'yieldscan:gf-voice-open'

export type GfVoiceOpenDetail = { autoStart?: boolean; setupMic?: boolean }

export function dispatchGfVoiceOpen(opts?: GfVoiceOpenDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<GfVoiceOpenDetail>(GF_VOICE_EVENT, { detail: opts ?? {} }))
}

/** Abre o gravador de voz (sem bloquear por permissão antecipada). */
export function openGfVoiceFromUserGesture(opts?: GfVoiceOpenDetail): void {
  dispatchGfVoiceOpen(opts)
}
