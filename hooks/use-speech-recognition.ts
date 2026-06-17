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

  useEffect(() => {
    void queryMicrophonePermission().then((state) => {
      setMicState(state)
      setMicReady(state === 'granted')
    })
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
      setError(
        result.state === 'denied'
          ? 'Microfone bloqueado — permita no aviso do celular ou use o botão azul «Abrir no navegador».'
          : 'Não foi possível ativar o microfone. Tente no navegador.',
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
        setError('Voz indisponível — digite no campo ou abra no navegador.')
        return false
      }

      if (requestPermissionFirst || !micReady) {
        const ok = await requestMic()
        if (!ok) return false
      }

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
          setError('Microfone bloqueado — use «Abrir no navegador» (botão azul).')
        } else if (ev.error === 'no-speech') {
          setError('Não ouvi nada. Fale de novo ou digite acima.')
        } else {
          setError('Erro ao ouvir — tente de novo ou digite acima.')
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
        setError('Não foi possível gravar — use o botão azul para abrir no navegador.')
        setListening(false)
        return false
      }
    },
    [lang, micReady, requestMic],
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
