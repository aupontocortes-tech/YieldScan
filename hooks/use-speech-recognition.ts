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
  const mobile = micPlatform === 'android' || micPlatform === 'ios'

  const supported = typeof window !== 'undefined' && getSpeechRecognition() != null

  const syncPermission = useCallback(async () => {
    const state = await queryMicrophonePermission()
    setMicState(state)
    setMicReady(state === 'granted')
    return state
  }, [])

  useEffect(() => {
    void syncPermission()
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return
    let cancelled = false
    void navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((result) => {
        const apply = () => {
          if (cancelled) return
          setMicState(result.state as MicPermissionState)
          setMicReady(result.state === 'granted')
        }
        apply()
        result.onchange = apply
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [syncPermission])

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  const requestMic = useCallback(async () => {
    const result = await requestMicrophoneAccess()
    setMicState(result.state)
    setMicReady(result.ok)
    if (!result.ok) {
      setError(
        result.state === 'denied'
          ? 'Microfone bloqueado — toque no cadeado do Chrome e permita o microfone.'
          : 'Não foi possível ativar o microfone — permita no aviso do Chrome.',
      )
    } else {
      setError(null)
    }
    return result.ok
  }, [])

  const start = useCallback(
    async (requestPermissionFirst = false) => {
      const Ctor = getSpeechRecognition()
      if (!Ctor) {
        setError('Voz indisponível neste navegador — use o microfone do teclado.')
        return false
      }

      if (requestPermissionFirst || !micReady) {
        const ok = await requestMic()
        if (!ok) return false
      }

      recRef.current?.abort()
      setError(null)
      setTranscript('')

      const rec = new Ctor()
      rec.lang = lang
      rec.continuous = !mobile
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
          setError('Microfone bloqueado — permita no aviso do Chrome ou no cadeado da barra.')
        } else if (ev.error === 'no-speech') {
          setError('Não ouvi nada. Toque em Falar e fale de novo.')
        } else if (ev.error !== 'aborted') {
          setError('Erro ao ouvir — toque em Falar e tente de novo.')
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
        setError('Não foi possível iniciar a voz — toque em Falar de novo.')
        setListening(false)
        return false
      }
    },
    [lang, micReady, mobile, requestMic],
  )

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
    setTranscript,
  }
}
