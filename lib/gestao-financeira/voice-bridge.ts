import { requestMicrophoneAccess } from '@/lib/mic-permission'

export const GF_VOICE_EVENT = 'yieldscan:gf-voice-open'

export type GfVoiceOpenDetail = { autoStart?: boolean }

export function dispatchGfVoiceOpen(opts?: GfVoiceOpenDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<GfVoiceOpenDetail>(GF_VOICE_EVENT, { detail: opts ?? {} }))
}

/**
 * Abre o gravador pedindo microfone no mesmo toque do utilizador.
 * Necessário para o celular mostrar o aviso de permissão (gesto do utilizador).
 */
export function openGfVoiceFromUserGesture(opts?: GfVoiceOpenDetail): void {
  if (typeof window === 'undefined') return
  void requestMicrophoneAccess()
  dispatchGfVoiceOpen(opts)
}
