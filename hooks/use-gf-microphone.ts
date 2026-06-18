'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'

type Options = {
  onTranscript: (text: string) => void
  onFocusKeyboard?: () => void
}

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
    if (startingRef.current || speech.listening) return false
    setHint(null)

    if (!speech.supported) {
      focusKeyboard()
      return false
    }

    startingRef.current = true
    setRequesting(true)
    try {
      const ok = await speech.start()
      if (!ok) {
        setHint(speech.error ?? 'Não foi possível ouvir. Tente de novo.')
      }
      return ok
    } finally {
      setRequesting(false)
      startingRef.current = false
    }
  }, [focusKeyboard, speech])

  const stopListening = useCallback(async () => {
    if (!speech.listening && !requesting) return
    setRequesting(true)
    try {
      const text = await speech.stop()
      if (text) onTranscript(text)
      else if (speech.transcript.trim()) onTranscript(speech.transcript.trim())
    } finally {
      setRequesting(false)
    }
  }, [onTranscript, requesting, speech])

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
    micBlocked: speech.micState === 'denied',
    liveText: speech.transcript,
    error: speech.error,
    hint,
    startListening,
    stopListening,
    requestPermission,
  }
}
