/**
 * Leitura de notícias via Speech Synthesis (nativo do navegador).
 * Um único áudio de cada vez; novo pedido cancela o anterior.
 */

let activeId: string | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function subscribeNewsSpeech(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
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

/** Para o que estiver a falar (ex.: ao sair da página). */
export function cancelNewsSpeech() {
  const syn = getSynth()
  if (syn) syn.cancel()
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
    syn.cancel()
    activeId = null
    emit()
    return
  }

  syn.cancel()
  activeId = id

  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'pt-BR'
  u.rate = 0.95

  const done = () => {
    if (activeId === id) {
      activeId = null
      emit()
    }
  }
  u.onend = done
  u.onerror = done

  syn.speak(u)
  emit()
}

export function isNewsSpeechSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'
}
