export const GF_FOCUS_PHRASE_EVENT = 'yieldscan:gf-focus-phrase'

export function dispatchGfFocusPhrase(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(GF_FOCUS_PHRASE_EVENT))
}
