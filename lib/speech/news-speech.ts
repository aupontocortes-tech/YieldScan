/**
 * Leitura de notícias via Speech Synthesis (nativo do navegador).
 * Um único áudio de cada vez; novo pedido cancela o anterior.
 */

import { isNewsTtsHeard } from '@/lib/news/news-tts-heard'

let activeId: string | null = null
const listeners = new Set<() => void>()
const endListeners = new Set<(id: string) => void>()

/** Progresso mínimo para marcar como ouvida (além de onend). */
const HEARD_PROGRESS = 0.8

type UtterRef = {
  id: string
  skipMarkHeard: boolean
  fullText: string
  heardEmitted: boolean
  progressTimer: ReturnType<typeof setInterval> | null
}

let currentUtteranceRef: UtterRef | null = null

function emit() {
  listeners.forEach((l) => l())
}

function emitHeard(id: string) {
  endListeners.forEach((l) => l(id))
}

function clearUtterProgress(utterRef: UtterRef) {
  if (utterRef.progressTimer != null) {
    clearInterval(utterRef.progressTimer)
    utterRef.progressTimer = null
  }
}

export function subscribeNewsSpeech(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

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

function aplicarVozPortugues(syn: SpeechSynthesis, u: SpeechSynthesisUtterance) {
  const vs = syn.getVoices()
  const pt =
    vs.find((v) => /^pt-BR|^pt_BR|^pt-br$/i.test(v.lang)) ??
    vs.find((v) => v.lang.toLowerCase() === 'pt-br') ??
    vs.find((v) => v.lang.toLowerCase().startsWith('pt'))
  if (pt) u.voice = pt
}

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
 * Inicia leitura (não faz toggle para parar).
 * `skipIfHeard`: evita TTS automático em notícias já ouvidas.
 */
export function playNewsSpeech(
  id: string,
  title: string,
  description: string,
  opts?: { skipIfHeard?: boolean }
) {
  if (opts?.skipIfHeard && isNewsTtsHeard(id)) return
  const syn = getSynth()
  if (!syn) return
  const text = [title.trim(), description.trim()].filter(Boolean).join('. ')
  if (!text) return
  if (activeId === id) return

  internalStart(id, text, syn)
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

  internalStart(id, text, syn)
}

function internalStart(id: string, text: string, syn: SpeechSynthesis) {
  if (currentUtteranceRef) currentUtteranceRef.skipMarkHeard = true
  syn.cancel()
  activeId = id

  const utterRef: UtterRef = {
    id,
    skipMarkHeard: false,
    fullText: text,
    heardEmitted: false,
    progressTimer: null,
  }
  currentUtteranceRef = utterRef

  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'pt-BR'
  u.rate = 0.95

  const tryProgressMarkByIndex = (charIndex: number) => {
    if (utterRef.skipMarkHeard || utterRef.heardEmitted) return
    const len = utterRef.fullText.length
    if (len <= 0) return
    if (charIndex / len >= HEARD_PROGRESS) {
      utterRef.heardEmitted = true
      emitHeard(id)
      clearUtterProgress(utterRef)
    }
  }

  u.onboundary = (ev: SpeechSynthesisEvent) => {
    tryProgressMarkByIndex(ev.charIndex ?? 0)
  }

  const finish = (markHeard: boolean) => {
    clearUtterProgress(utterRef)
    if (activeId === id) activeId = null
    const shouldMark =
      markHeard && currentUtteranceRef === utterRef && !utterRef.skipMarkHeard
    if (currentUtteranceRef === utterRef) currentUtteranceRef = null
    emit()
    if (shouldMark) emitHeard(id)
  }

  u.onend = () => finish(true)
  u.onerror = () => finish(false)

  const t0 = performance.now()
  utterRef.progressTimer = setInterval(() => {
    if (utterRef.skipMarkHeard || utterRef.heardEmitted) {
      clearUtterProgress(utterRef)
      return
    }
    const elapsed = (performance.now() - t0) / 1000
    const approxChars = elapsed * 13 * u.rate
    tryProgressMarkByIndex(approxChars)
  }, 320)

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
  if (typeof window === 'undefined') return false
  try {
    return Boolean(window.speechSynthesis)
  } catch {
    return false
  }
}

/** iOS/Safari: força carregar vozes após gesto do utilizador. */
export function primeNewsSpeechVoices(): void {
  const syn = getSynth()
  if (!syn) return
  try {
    syn.getVoices()
  } catch {
    /* ignore */
  }
}
