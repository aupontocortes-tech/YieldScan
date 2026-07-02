/**
 * Leitura de resumos da Gestão Financeira via Speech Synthesis (nativo do navegador).
 */

let activeId: string | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function subscribeGfSpeech(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getGfSpeechActiveId(): string | null {
  return activeId
}

export function getGfSpeechActiveIdServer(): string | null {
  return null
}

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  return window.speechSynthesis ?? null
}

function aplicarVozPortugues(syn: SpeechSynthesis, u: SpeechSynthesisUtterance) {
  const vs = syn.getVoices()
  const pt =
    vs.find((v) => /^pt-BR|^pt_BR|^pt-br$/i.test(v.lang)) ??
    vs.find((v) => v.lang.toLowerCase() === 'pt-br') ??
    vs.find((v) => v.lang.toLowerCase().startsWith('pt'))
  if (pt) u.voice = pt
}

export function cancelGfSpeech() {
  const syn = getSynth()
  syn?.cancel()
  activeId = null
  emit()
}

export function toggleGfSpeech(id: string, text: string) {
  const syn = getSynth()
  if (!syn) return
  const trimmed = text.trim()
  if (!trimmed) return

  if (activeId === id) {
    syn.cancel()
    activeId = null
    emit()
    return
  }

  syn.cancel()
  activeId = id

  const u = new SpeechSynthesisUtterance(trimmed)
  u.lang = 'pt-BR'
  u.rate = 0.92

  const finish = () => {
    if (activeId === id) activeId = null
    emit()
  }

  u.onend = finish
  u.onerror = finish

  const falar = () => {
    aplicarVozPortugues(syn, u)
    syn.speak(u)
  }

  if (syn.getVoices().length > 0) {
    falar()
  } else {
    const once = () => {
      syn.removeEventListener('voiceschanged', once)
      falar()
    }
    syn.addEventListener('voiceschanged', once)
    window.setTimeout(() => {
      syn.removeEventListener('voiceschanged', once)
      falar()
    }, 500)
  }
  emit()
}

export function isGfSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return Boolean(window.speechSynthesis)
  } catch {
    return false
  }
}

export function primeGfSpeechVoices(): void {
  const syn = getSynth()
  if (!syn) return
  try {
    syn.getVoices()
  } catch {
    /* ignore */
  }
}
