'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  detectMicPlatform,
  queryMicrophonePermission,
  requestMicrophoneAccess,
  type MicPermissionState,
  type MicPlatform,
} from '@/lib/mic-permission'

type SpeechResultEvent = {
  results: { length: number; [i: number]: { [j: number]: { transcript: string } } }
}

type SpeechErrorEvent = { error: string }

type SpeechCtor = new () => {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((ev: SpeechResultEvent) => void) | null
  onerror: ((ev: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function getSpeechRecognition(): SpeechCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechCtor
    webkitSpeechRecognition?: SpeechCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useSpeechRecognition(lang = 'pt-BR') {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [micReady, setMicReady] = useState(false)
  const [micState, setMicState] = useState<MicPermissionState>('prompt')
  const [micPlatform] = useState<MicPlatform>(() => detectMicPlatform())
  const recRef = useRef<InstanceType<SpeechCtor> | null>(null)

  const supported = typeof window !== 'undefined' && getSpeechRecognition() != null

  const refreshMicState = useCallback(async () => {
    const state = await queryMicrophonePermission()
    setMicState(state)
    setMicReady(state === 'granted')
    return state
  }, [])

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  const requestMic = useCallback(async () => {
    const result = await requestMicrophoneAccess()
    setMicState(result.state)
    setMicReady(result.ok)
    if (!result.ok) {
      if (result.state === 'denied') {
        setError('Microfone bloqueado. Use o botão abaixo e siga os passos.')
      } else if (result.state === 'unsupported') {
        setError('Microfone indisponível neste navegador — use o texto abaixo.')
      } else {
        setError('Não foi possível ativar o microfone. Tente novamente.')
      }
    } else {
      setError(null)
    }
    return result.ok
  }, [])

  const start = useCallback(async () => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      setError('Reconhecimento de voz não suportado neste navegador.')
      return false
    }

    const hasMic = micReady || (await requestMic())
    if (!hasMic) return false

    setError(null)
    setTranscript('')
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (ev) => {
      let text = ''
      for (let i = 0; i < ev.results.length; i++) {
        text += ev.results[i]![0]!.transcript
      }
      setTranscript(text.trim())
    }
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed') {
        setMicState('denied')
        setMicReady(false)
        setError('Microfone bloqueado. Toque em «Permitir microfone» e siga os passos.')
      } else {
        setError('Erro ao ouvir. Tente novamente.')
      }
      setListening(false)
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
      return true
    } catch {
      setError('Não foi possível iniciar o microfone.')
      setListening(false)
      return false
    }
  }, [lang, micReady, requestMic])

  useEffect(() => {
    void refreshMicState()
  }, [refreshMicState])

  useEffect(() => () => recRef.current?.abort(), [])

  return {
    supported,
    listening,
    transcript,
    error,
    micReady,
    micState,
    micPlatform,
    start,
    stop,
    requestMic,
    refreshMicState,
    setTranscript,
  }
}
