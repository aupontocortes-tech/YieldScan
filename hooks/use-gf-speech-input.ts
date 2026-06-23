'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  checkGfOpenAiLimits,
  loadGfOpenAiSettings,
} from '@/lib/gestao-financeira/openai-config'
import { transcribeGfVoiceWithOpenAi } from '@/lib/gestao-financeira/transcribe-with-openai'
import { detectMicPlatform } from '@/lib/mic-permission'

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

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true },
  video: false,
}

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

/** Deve ser chamado de forma síncrona no clique — abre o aviso do navegador. */
export function requestMicStreamSync(): Promise<MediaStream> | null {
  if (!canRecordAudio()) return null
  return navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
}

function pickMimeType(): string | undefined {
  const android = detectMicPlatform() === 'android'
  const types = android
    ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac', 'audio/ogg;codecs=opus']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/aac']
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return undefined
}

function resolveSpeechMode(): GfSpeechMode {
  const settings = loadGfOpenAiSettings()
  const openAiReady = settings.enabled && settings.apiKey.trim()

  if (openAiReady && canRecordAudio()) return 'whisper'
  if (getSpeechRecognition()) return 'browser'
  return 'none'
}

function micErrorFromException(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Microfone bloqueado. Toque no 🎤 e escolha Permitir.'
    }
    if (err.name === 'NotFoundError') return 'Nenhum microfone encontrado.'
    if (err.name === 'NotReadableError') return 'Microfone em uso por outra app.'
  }
  return 'Não foi possível usar o microfone.'
}

function releaseStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop())
}

export function useGfSpeechInput() {
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [requestingPermission, setRequestingPermission] = useState(false)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopStream = useCallback(() => {
    releaseStream(streamRef.current)
    streamRef.current = null
  }, [])

  const stopWhisperRecording = useCallback(() => {
    if (maxTimerRef.current != null) {
      window.clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
    const rec = mediaRecorderRef.current
    if (rec?.state === 'recording') {
      try {
        rec.requestData()
      } catch {
        /* ignore */
      }
      rec.stop()
    } else {
      stopStream()
      setListening(false)
    }
  }, [stopStream])

  const finishWhisper = useCallback(async (blob: Blob, durationSeconds: number) => {
    setTranscribing(true)
    try {
      const { text, error } = await transcribeGfVoiceWithOpenAi(blob, durationSeconds)
      if (text) onFinalRef.current(text)
      else if (error) setMicError(error)
    } finally {
      setTranscribing(false)
      setListening(false)
    }
  }, [])

  const beginWhisperRecording = useCallback(
    (stream: MediaStream) => {
      streamRef.current = stream
      chunksRef.current = []
      recordStartRef.current = Date.now()

      const mime = pickMimeType()
      let recorder: MediaRecorder
      try {
        recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      } catch {
        recorder = new MediaRecorder(stream)
      }
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }

      recorder.onerror = () => {
        setMicError('Erro ao gravar áudio.')
        stopStream()
        setListening(false)
      }

      recorder.onstop = () => {
        const durationSeconds = Math.max(1, (Date.now() - recordStartRef.current) / 1000)
        stopStream()
        const blobType = recorder.mimeType || mime || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: blobType })
        chunksRef.current = []
        mediaRecorderRef.current = null
        if (blob.size > 800) {
          void finishWhisper(blob, durationSeconds)
        } else {
          setListening(false)
          setMicError('Gravação vazia. Fale mais perto e toque no 🎤 de novo.')
        }
      }

      recorder.start()
      setListening(true)

      maxTimerRef.current = window.setTimeout(() => {
        stopWhisperRecording()
      }, MAX_RECORD_SECONDS * 1000)
    },
    [finishWhisper, stopStream, stopWhisperRecording],
  )

  const startBrowser = useCallback((onFinal: (text: string) => void, stream: MediaStream): boolean => {
    setMicError(null)
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      releaseStream(stream)
      return false
    }

    releaseStream(stream)

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
      setMicError(ev.error === 'not-allowed' ? 'Microfone bloqueado.' : `Erro: ${ev.error}`)
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
      setMicError('Não foi possível iniciar o microfone.')
      return false
    }
  }, [])

  const stopBrowser = useCallback(() => {
    wantListenRef.current = false
    recRef.current?.stop()
    setListening(false)
  }, [])

  const continueWithStream = useCallback(
    (stream: MediaStream, onFinal: (text: string) => void) => {
      const currentMode = resolveSpeechMode()
      setMode(currentMode)

      if (currentMode === 'whisper') {
        const limit = checkGfOpenAiLimits(loadGfOpenAiSettings())
        if (!limit.ok) {
          releaseStream(stream)
          setMicError(limit.reason)
          return
        }
        beginWhisperRecording(stream)
        return
      }

      if (currentMode === 'browser') {
        startBrowser(onFinal, stream)
        return
      }

      releaseStream(stream)
      setMicError('Ative a IA em Uso da API para usar o microfone.')
    },
    [beginWhisperRecording, startBrowser],
  )

  const toggle = useCallback(
    (onFinal: (text: string) => void, micPromise?: Promise<MediaStream> | null) => {
      onFinalRef.current = onFinal
      const currentMode = resolveSpeechMode()
      setMode(currentMode)

      if (listening || transcribing) {
        if (currentMode === 'whisper') stopWhisperRecording()
        else stopBrowser()
        return
      }

      if (!canRecordAudio()) {
        setMicError('Microfone indisponível neste navegador.')
        return
      }

      setMicError(null)

      const streamPromise = micPromise ?? requestMicStreamSync()
      if (!streamPromise) {
        setMicError('Microfone indisponível neste navegador.')
        return
      }

      setRequestingPermission(true)

      void streamPromise
        .then((stream) => {
          setRequestingPermission(false)
          continueWithStream(stream, onFinal)
        })
        .catch((err: unknown) => {
          setRequestingPermission(false)
          setMicError(micErrorFromException(err))
        })
    },
    [listening, transcribing, continueWithStream, stopBrowser, stopWhisperRecording],
  )

  return {
    listening: listening || transcribing,
    transcribing,
    requestingPermission,
    supported: canRecordAudio(),
    mode,
    micError,
    toggle,
    clearError: () => setMicError(null),
  }
}
