'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  checkGfOpenAiLimits,
  loadGfOpenAiSettings,
} from '@/lib/gestao-financeira/openai-config'
import { transcribeGfVoiceWithOpenAi } from '@/lib/gestao-financeira/transcribe-with-openai'
import {
  micFailureMessage,
  requestMicrophoneAccess,
  type MicAccessResult,
} from '@/lib/mic-permission'

export type GfSpeechMode = 'browser' | 'whisper' | 'none'

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } }
}

const MAX_RECORD_SECONDS = 25

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function canRecordAudio(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

function pickMimeType(): string | undefined {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return undefined
}

function resolveSpeechMode(): GfSpeechMode {
  if (getSpeechRecognition()) return 'browser'
  if (canRecordAudio()) {
    const s = loadGfOpenAiSettings()
    if (s.enabled && s.apiKey.trim()) return 'whisper'
  }
  return 'none'
}

export function useGfSpeechInput() {
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [mode, setMode] = useState<GfSpeechMode>('none')
  const [micError, setMicError] = useState<string | null>(null)

  const recRef = useRef<SpeechRecognitionInstance | null>(null)
  const wantListenRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordStartRef = useRef(0)
  const maxTimerRef = useRef<number | null>(null)
  const onFinalRef = useRef<(text: string) => void>(() => {})

  useEffect(() => {
    setMode(resolveSpeechMode())
    return () => {
      recRef.current?.abort()
      stopWhisperRecording()
    }
  }, [])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const stopWhisperRecording = useCallback(() => {
    if (maxTimerRef.current != null) {
      window.clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    } else {
      stopStream()
      setListening(false)
    }
  }, [stopStream])

  const finishWhisper = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      setTranscribing(true)
      try {
        const { text, error } = await transcribeGfVoiceWithOpenAi(blob, durationSeconds)
        if (text) onFinalRef.current(text)
        else if (error) setMicError(error)
      } finally {
        setTranscribing(false)
        setListening(false)
      }
    },
    [],
  )

  const startWhisper = useCallback(async (): Promise<boolean> => {
    setMicError(null)
    const settings = loadGfOpenAiSettings()
    const limit = checkGfOpenAiLimits(settings)
    if (!limit.ok) {
      setMicError(limit.reason)
      return false
    }

    const mic: MicAccessResult = await requestMicrophoneAccess()
    if (!mic.ok) {
      setMicError(micFailureMessage(mic, false))
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      recordStartRef.current = Date.now()

      const mime = pickMimeType()
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }

      recorder.onstop = () => {
        const durationSeconds = Math.max(1, (Date.now() - recordStartRef.current) / 1000)
        stopStream()
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        chunksRef.current = []
        mediaRecorderRef.current = null
        if (blob.size > 0) {
          void finishWhisper(blob, durationSeconds)
        } else {
          setListening(false)
          setMicError('Gravação vazia. Toque no microfone e fale de novo.')
        }
      }

      recorder.start(250)
      setListening(true)

      maxTimerRef.current = window.setTimeout(() => {
        stopWhisperRecording()
      }, MAX_RECORD_SECONDS * 1000)

      return true
    } catch {
      stopStream()
      setListening(false)
      setMicError('Não foi possível gravar áudio. Verifique a permissão do microfone.')
      return false
    }
  }, [finishWhisper, stopStream, stopWhisperRecording])

  const startBrowser = useCallback(async (onFinal: (text: string) => void): Promise<boolean> => {
    setMicError(null)
    const Ctor = getSpeechRecognition()
    if (!Ctor) return false

    const mic: MicAccessResult = await requestMicrophoneAccess()
    if (!mic.ok) {
      setMicError(micFailureMessage(mic, false))
      return false
    }

    recRef.current?.abort()
    const rec = new Ctor()
    rec.lang = 'pt-BR'
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    wantListenRef.current = true
    setListening(true)

    rec.onresult = (ev) => {
      let transcript = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        transcript += ev.results[i]![0].transcript
      }
      if (ev.results[ev.results.length - 1]?.isFinal) {
        const final = transcript.trim()
        if (final) onFinal(final)
      }
    }

    rec.onerror = (ev) => {
      if (ev.error === 'aborted' || ev.error === 'no-speech') return
      setMicError(
        ev.error === 'not-allowed'
          ? 'Microfone bloqueado. Permita nas configurações do site.'
          : `Erro de voz: ${ev.error}`,
      )
    }

    rec.onend = () => {
      setListening(false)
      wantListenRef.current = false
    }

    recRef.current = rec
    try {
      rec.start()
      return true
    } catch {
      setListening(false)
      setMicError('Não foi possível iniciar o microfone. Tente de novo.')
      return false
    }
  }, [])

  const stopBrowser = useCallback(() => {
    wantListenRef.current = false
    recRef.current?.stop()
    setListening(false)
  }, [])

  const toggle = useCallback(
    async (onFinal: (text: string) => void) => {
      onFinalRef.current = onFinal
      const currentMode = resolveSpeechMode()
      setMode(currentMode)

      if (listening || transcribing) {
        if (currentMode === 'whisper') stopWhisperRecording()
        else stopBrowser()
        return
      }

      if (currentMode === 'browser') {
        await startBrowser(onFinal)
        return
      }

      if (currentMode === 'whisper') {
        await startWhisper()
        return
      }

      const settings = loadGfOpenAiSettings()
      if (canRecordAudio() && (!settings.enabled || !settings.apiKey.trim())) {
        setMicError('Neste navegador, ative a OpenAI em «Uso da API» para usar o microfone.')
      } else {
        setMicError('Microfone indisponível neste dispositivo.')
      }
    },
    [listening, transcribing, startBrowser, startWhisper, stopBrowser, stopWhisperRecording],
  )

  const supported = mode !== 'none' || canRecordAudio()

  return {
    listening: listening || transcribing,
    transcribing,
    supported,
    mode,
    micError,
    toggle,
    clearError: () => setMicError(null),
  }
}
