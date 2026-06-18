'use client'

import { useCallback, useEffect, useState } from 'react'
import { prefersKeyboardDictation } from '@/lib/gestao-financeira/voice-input-mode'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'

type Options = {
  onTranscript: (text: string) => void
  onFocusKeyboard?: () => void
}

/** Microfone 100% grátis: Web Speech API do navegador ou microfone do teclado. */
export function useGfMicrophone({ onTranscript, onFocusKeyboard }: Options) {
  const [hint, setHint] = useState<string | null>(null)
  const speech = useSpeechRecognition()
  const mobile = prefersKeyboardDictation()

  const focusKeyboard = useCallback(() => {
    onFocusKeyboard?.()
    setHint('Toque no ícone do microfone no teclado do celular e fale.')
  }, [onFocusKeyboard])

  const toggle = useCallback(async () => {
    setHint(null)

    if (!speech.supported) {
      focusKeyboard()
      return
    }

    if (speech.listening) {
      speech.stop()
      if (speech.transcript.trim()) onTranscript(speech.transcript.trim())
      return
    }

    const ok = await speech.start(!mobile)
    if (!ok) {
      focusKeyboard()
    }
  }, [focusKeyboard, mobile, onTranscript, speech])

  useEffect(() => {
    if (!speech.transcript) return
    onTranscript(speech.transcript)
  }, [onTranscript, speech.transcript])

  useEffect(() => {
    if (!speech.error) return
    if (speech.error.includes('teclado') || speech.error.includes('digite')) {
      setHint(speech.error)
      focusKeyboard()
    }
  }, [focusKeyboard, speech.error])

  return {
    webspeech: speech.supported,
    recording: speech.listening,
    error: speech.error,
    hint,
    toggle,
  }
}
