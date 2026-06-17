import { ensureMicrophoneAccess } from '@/lib/mic-permission'

export const GF_VOICE_EVENT = 'yieldscan:gf-voice-open'

export type GfVoiceOpenDetail = { autoStart?: boolean }

export function dispatchGfVoiceOpen(opts?: GfVoiceOpenDetail): void {
  if (typeof window === 'undefined') return
  void ensureMicrophoneAccess()
  window.dispatchEvent(new CustomEvent<GfVoiceOpenDetail>(GF_VOICE_EVENT, { detail: opts ?? {} }))
}
