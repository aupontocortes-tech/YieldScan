/**
 * Leitura de notícias via Speech Synthesis (nativo do navegador).
 * Um único áudio de cada vez; novo pedido cancela o anterior.
 */

let activeId: string | null = null
const listeners = new Set<() => void>()
const endListeners = new Set<(id: string) => void>()

type UtterRef = { id: string; skipMarkHeard: boolean }

/** Ref do utterance corrente (para não marcar "ouvido" ao parar ou ao trocar de notícia). */
let currentUtteranceRef: UtterRef | null = null

function emit() {
  listeners.forEach((l) => l())
}

function emitHeard(id: string) {
  endListeners.forEach((l) => l(id))
}

export function subscribeNewsSpeech(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Dispara só quando a leitura termina até ao fim (não ao parar nem ao mudar de item). */
export function subscribeNewsSpeechHeard(listener: (id: string) => void) {
  endListeners.add(listener)
  return () => {
    endListeners.delete(listener)
  }
}

export function getNewsSpeechActiveId(): string | null {
  return activeId
}

export function getNewsSpeechActiveIdServer(): string | null {
  return null
}

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  return window.speechSynthesis ?? null
}

/** Escolhe voz em português (prioridade pt-BR) para o sintetizador não usar inglês por defeito. */
function aplicarVozPortugues(syn: SpeechSynthesis, u: SpeechSynthesisUtterance) {
  const vs = syn.getVoices()
  const pt =
    vs.find((v) => /^pt-BR|^pt_BR|^pt-br$/i.test(v.lang)) ??
    vs.find((v) => v.lang.toLowerCase() === 'pt-br') ??
    vs.find((v) => v.lang.toLowerCase().startsWith('pt'))
  if (pt) u.voice = pt
}

/** Para o que estiver a falar (ex.: ao sair da página). */
export function cancelNewsSpeech() {
  const syn = getSynth()
  if (syn) {
    if (currentUtteranceRef) currentUtteranceRef.skipMarkHeard = true
    syn.cancel()
  }
  activeId = null
  emit()
}

/**
 * Se `id` já estiver activo → para.
 * Caso contrário → cancela o anterior e lê `title` + `description` em pt-BR.
 */
export function toggleNewsSpeech(id: string, title: string, description: string) {
  const syn = getSynth()
  if (!syn) return

  const text = [title.trim(), description.trim()].filter(Boolean).join('. ')
  if (!text) return

  if (activeId === id) {
    if (currentUtteranceRef?.id === id) currentUtteranceRef.skipMarkHeard = true
    syn.cancel()
    activeId = null
    emit()
    return
  }

  if (currentUtteranceRef) currentUtteranceRef.skipMarkHeard = true
  syn.cancel()
  activeId = id

  const utterRef: UtterRef = { id, skipMarkHeard: false }
  currentUtteranceRef = utterRef

  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'pt-BR'
  u.rate = 0.95

  const finish = (markHeard: boolean) => {
    if (activeId === id) {
      activeId = null
    }
    const shouldMark =
      markHeard && currentUtteranceRef === utterRef && !utterRef.skipMarkHeard
    if (currentUtteranceRef === utterRef) currentUtteranceRef = null
    emit()
    if (shouldMark) emitHeard(id)
  }

  u.onend = () => finish(true)
  u.onerror = () => finish(false)

  let iniciou = false
  const falar = () => {
    if (iniciou) return
    iniciou = true
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

export function isNewsSpeechSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'
}
