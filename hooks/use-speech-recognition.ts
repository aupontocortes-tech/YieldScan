'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { detectMicPlatform, type MicPlatform } from '@/lib/mic-permission'

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
  const [micPlatform] = useState<MicPlatform>(() => detectMicPlatform())
  const recRef = useRef<InstanceType<SpeechCtor> | null>(null)

  const supported = typeof window !== 'undefined' && getSpeechRecognition() != null

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  /** Inicia gravação — pede permissão só aqui, no toque em Gravar. */
  const start = useCallback(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      setError('Voz indisponível neste modo — digite no campo acima.')
      return false
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
        setError('Microfone bloqueado — digite no campo acima (funciona igual).')
      } else if (ev.error === 'no-speech') {
        setError('Não ouvi nada. Tente de novo ou digite acima.')
      } else {
        setError('Erro ao ouvir — digite no campo acima.')
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
      setError('Não foi possível gravar — digite no campo acima.')
      setListening(false)
      return false
    }
  }, [lang])

  useEffect(() => () => recRef.current?.abort(), [])

  return { supported, listening, transcript, error, micPlatform, start, stop, setTranscript }
}
