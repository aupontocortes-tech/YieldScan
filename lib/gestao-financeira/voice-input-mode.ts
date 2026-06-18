/** Celular/tablet: o microfone do teclado é fiável; Web Speech API no app costuma falhar. */
export function prefersKeyboardDictation(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(pointer: coarse)').matches) return true
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}
