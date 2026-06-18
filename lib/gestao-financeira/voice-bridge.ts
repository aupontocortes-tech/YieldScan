import { prefersKeyboardDictation } from '@/lib/gestao-financeira/voice-input-mode'

export const GF_VOICE_EVENT = 'yieldscan:gf-voice-open'
export const GF_FOCUS_PHRASE_EVENT = 'yieldscan:gf-focus-phrase'
export const GF_START_APP_MIC_EVENT = 'yieldscan:gf-start-app-mic'

export type GfVoiceOpenDetail = { autoStart?: boolean; setupMic?: boolean }

export function dispatchGfVoiceOpen(opts?: GfVoiceOpenDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<GfVoiceOpenDetail>(GF_VOICE_EVENT, { detail: opts ?? {} }))
}

export function dispatchGfFocusPhrase(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(GF_FOCUS_PHRASE_EVENT))
}

/** Inicia gravação pelo microfone do aplicativo (botão verde). */
export function dispatchGfStartAppMic(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(GF_START_APP_MIC_EVENT))
}

/** Celular: microfone do app. Desktop: diálogo com voz do navegador. */
export function openGfVoiceFromUserGesture(opts?: GfVoiceOpenDetail): void {
  if (prefersKeyboardDictation()) {
    dispatchGfStartAppMic()
    return
  }
  dispatchGfVoiceOpen(opts)
}
