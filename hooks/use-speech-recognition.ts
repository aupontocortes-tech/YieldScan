'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureMicrophoneAccess } from '@/lib/mic-permission'

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
  const recRef = useRef<InstanceType<SpeechCtor> | null>(null)

  const supported = typeof window !== 'undefined' && getSpeechRecognition() != null

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  const requestMic = useCallback(async () => {
    const ok = await ensureMicrophoneAccess()
    setMicReady(ok)
    if (!ok) {
      setError('Permissão de microfone negada. Ative nas configurações do navegador.')
    } else {
      setError(null)
    }
    return ok
  }, [])

  const start = useCallback(async () => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      setError('Reconhecimento de voz não suportado neste navegador.')
      return
    }

    const hasMic = micReady || (await requestMic())
    if (!hasMic) return

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
      setError(ev.error === 'not-allowed' ? 'Permissão de microfone negada.' : 'Erro ao ouvir.')
      setListening(false)
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setError('Não foi possível iniciar o microfone.')
      setListening(false)
    }
  }, [lang, micReady, requestMic])

  useEffect(() => () => recRef.current?.abort(), [])

  return { supported, listening, transcript, error, micReady, start, stop, requestMic, setTranscript }
}
