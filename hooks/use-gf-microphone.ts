'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'

type Options = {
  onTranscript: (text: string) => void
  onFocusKeyboard?: () => void
}

/** Voz grátis via Web Speech API — pede permissão ao Chrome no gesto do utilizador. */
export function useGfMicrophone({ onTranscript, onFocusKeyboard }: Options) {
  const [hint, setHint] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const startingRef = useRef(false)
  const speech = useSpeechRecognition()

  const focusKeyboard = useCallback(() => {
    onFocusKeyboard?.()
    setHint('Toque no ícone do microfone no teclado do celular e fale.')
  }, [onFocusKeyboard])

  const requestPermission = useCallback(async () => {
    if (!speech.supported) {
      focusKeyboard()
      return false
    }
    setHint(null)
    setRequesting(true)
    try {
      return await speech.requestMic()
    } finally {
      setRequesting(false)
    }
  }, [focusKeyboard, speech])

  const startListening = useCallback(async () => {
    if (startingRef.current || speech.listening || requesting) return false
    setHint(null)

    if (!speech.supported) {
      focusKeyboard()
      return false
    }

    startingRef.current = true
    setRequesting(true)
    try {
      // Se permissão já está ativa, inicia direto sem pedir de novo
      const ok = await speech.start(!speech.micReady)
      if (!ok) {
        setHint('Não foi possível ouvir. Tente de novo ou use o microfone do teclado.')
      }
      return ok
    } finally {
      setRequesting(false)
      startingRef.current = false
    }
  }, [focusKeyboard, requesting, speech])

  const stopListening = useCallback(() => {
    if (!speech.listening) return
    speech.stop()
    const text = speech.transcript.trim()
    if (text) onTranscript(text)
  }, [onTranscript, speech])

  useEffect(() => {
    if (!speech.transcript || !speech.listening) return
    onTranscript(speech.transcript)
  }, [onTranscript, speech.listening, speech.transcript])

  useEffect(() => {
    if (!speech.error) return
    setHint(speech.error)
  }, [speech.error])

  return {
    webspeech: speech.supported,
    recording: speech.listening,
    requesting,
    micReady: speech.micReady,
    error: speech.error,
    hint,
    startListening,
    stopListening,
    requestPermission,
  }
}
