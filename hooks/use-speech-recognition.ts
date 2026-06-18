'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  detectMicPlatform,
  queryMicrophonePermission,
  type MicPermissionState,
  type MicPlatform,
} from '@/lib/mic-permission'

type SpeechResultEvent = {
  results: { length: number; [i: number]: { isFinal?: boolean; [j: number]: { transcript: string } } }
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
  const streamRef = useRef<MediaStream | null>(null)
  const transcriptRef = useRef('')
  const activeRef = useRef(false)
  const stopResolveRef = useRef<((text: string) => void) | null>(null)

  const supported = typeof window !== 'undefined' && getSpeechRecognition() != null

  const closeMicStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const syncPermission = useCallback(async () => {
    const state = await queryMicrophonePermission()
    setMicState(state)
    if (state === 'granted') setMicReady(true)
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
          if (result.state === 'granted') setMicReady(true)
        }
        apply()
        result.onchange = apply
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [syncPermission])

  const openMicStream = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false
    if (!window.isSecureContext) return false
    if (streamRef.current?.active) return true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      })
      closeMicStream()
      streamRef.current = stream
      setMicReady(true)
      setMicState('granted')
      setError(null)
      return true
    } catch (err) {
      const denied =
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      setMicState(denied ? 'denied' : 'prompt')
      setMicReady(false)
      setError(
        denied
          ? 'Microfone bloqueado — permita no aviso do Chrome ou no cadeado da barra.'
          : 'Não foi possível aceder ao microfone.',
      )
      return false
    }
  }, [closeMicStream])

  const requestMic = useCallback(async () => openMicStream(), [openMicStream])

  const attachRecognitionHandlers = useCallback(
    (rec: InstanceType<SpeechCtor>) => {
      rec.onresult = (ev) => {
        let text = ''
        for (let i = 0; i < ev.results.length; i++) {
          text += ev.results[i]![0]!.transcript
        }
        const trimmed = text.trim()
        transcriptRef.current = trimmed
        setTranscript(trimmed)
      }
      rec.onerror = (ev) => {
        if (ev.error === 'not-allowed') {
          setMicState('denied')
          setMicReady(false)
          setError('Microfone bloqueado — permita no aviso do Chrome.')
          activeRef.current = false
          setListening(false)
        } else if (ev.error === 'no-speech') {
          setError('Não ouvi nada. Fale mais alto e tente de novo.')
        } else if (ev.error !== 'aborted') {
          setError(`Erro ao ouvir (${ev.error}). Toque em Falar de novo.`)
        }
      }
      rec.onend = () => {
        if (activeRef.current && recRef.current === rec) {
          try {
            rec.start()
            return
          } catch {
            // reinício falhou — termina sessão
          }
        }
        activeRef.current = false
        setListening(false)
        closeMicStream()
        stopResolveRef.current?.(transcriptRef.current.trim())
        stopResolveRef.current = null
      }
    },
    [closeMicStream],
  )

  const start = useCallback(async () => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      setError('Voz indisponível neste navegador — use o microfone do teclado.')
      return false
    }

    const micOk = await openMicStream()
    if (!micOk) return false

    recRef.current?.abort()
    setError(null)
    transcriptRef.current = ''
    setTranscript('')

    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    attachRecognitionHandlers(rec)
    recRef.current = rec
    activeRef.current = true

    try {
      rec.start()
      setListening(true)
      return true
    } catch {
      activeRef.current = false
      closeMicStream()
      setError('Não foi possível iniciar a voz — toque em Falar de novo.')
      setListening(false)
      return false
    }
  }, [attachRecognitionHandlers, closeMicStream, lang, openMicStream])

  const stop = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const rec = recRef.current
      const text = transcriptRef.current.trim()
      if (!rec || !activeRef.current) {
        activeRef.current = false
        setListening(false)
        closeMicStream()
        resolve(text)
        return
      }
      stopResolveRef.current = resolve
      activeRef.current = false
      try {
        rec.stop()
      } catch {
        setListening(false)
        closeMicStream()
        stopResolveRef.current = null
        resolve(transcriptRef.current.trim())
      }
    })
  }, [closeMicStream])

  const abort = useCallback(() => {
    activeRef.current = false
    recRef.current?.abort()
    setListening(false)
    closeMicStream()
    stopResolveRef.current?.(transcriptRef.current.trim())
    stopResolveRef.current = null
  }, [closeMicStream])

  useEffect(
    () => () => {
      activeRef.current = false
      recRef.current?.abort()
      closeMicStream()
    },
    [closeMicStream],
  )

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
    abort,
    requestMic,
    setTranscript: (text: string) => {
      transcriptRef.current = text
      setTranscript(text)
    },
  }
}
