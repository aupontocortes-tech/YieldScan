export const GF_FOCUS_PHRASE_EVENT = 'yieldscan:gf-focus-phrase'
export const GF_REQUEST_MIC_EVENT = 'yieldscan:gf-request-mic'

export function dispatchGfFocusPhrase(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(GF_FOCUS_PHRASE_EVENT))
}

export function dispatchGfRequestMic(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(GF_REQUEST_MIC_EVENT))
}
