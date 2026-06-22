'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  checkGfOpenAiLimits,
  loadGfOpenAiSettings,
} from '@/lib/gestao-financeira/openai-config'
import { transcribeGfVoiceWithOpenAi } from '@/lib/gestao-financeira/transcribe-with-openai'
import {
  detectMicPlatform,
  isStandalonePwa,
  micFailureMessage,
  micPermissionHelpLines,
  openVoiceInSystemBrowser,
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

function isMobileDevice(): boolean {
  return detectMicPlatform() !== 'desktop'
}

function pickMimeType(): string | undefined {
  const androidFirst = isMobileDevice()
    ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/aac']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  for (const t of androidFirst) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return undefined
}

function resolveSpeechMode(): GfSpeechMode {
  const settings = loadGfOpenAiSettings()
  const openAiReady = settings.enabled && settings.apiKey.trim()

  // Celular: Whisper (gravação) — Web Speech no Android é instável.
  if (openAiReady && canRecordAudio()) return 'whisper'
  if (!isMobileDevice() && getSpeechRecognition()) return 'browser'
  if (canRecordAudio() && openAiReady) return 'whisper'
  return 'none'
}

function micErrorFromException(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Microfone bloqueado. Permita nas configurações do site (⋮ → Informações do site → Microfone).'
    }
    if (err.name === 'NotFoundError') {
      return 'Nenhum microfone encontrado neste dispositivo.'
    }
    if (err.name === 'NotReadableError') {
      return 'Microfone em uso por outra app. Feche gravações/chamadas e tente de novo.'
    }
    return `Erro de microfone: ${err.name}`
  }
  return 'Não foi possível gravar áudio. Verifique a permissão do microfone.'
}

export function useGfSpeechInput() {
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [mode, setMode] = useState<GfSpeechMode>('none')
  const [micError, setMicError] = useState<string | null>(null)
  const [micReady, setMicReady] = useState<boolean | null>(null)

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
    streamRef.current?.getTracks().forEach((t) => t.stop())
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

  const startWhisper = useCallback(async (): Promise<boolean> => {
    setMicError(null)
    const settings = loadGfOpenAiSettings()
    const limit = checkGfOpenAiLimits(settings)
    if (!limit.ok) {
      setMicError(limit.reason)
      return false
    }

    if (!window.isSecureContext) {
      setMicError('Microfone exige HTTPS. Abra pelo Chrome com https://yield-scan.vercel.app')
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      })
      setMicReady(true)
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
        setMicError('Erro ao gravar áudio neste dispositivo.')
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
          setMicError(
            isStandalonePwa()
              ? 'Gravação vazia. Abra no Chrome (botão abaixo) e tente de novo.'
              : 'Gravação vazia. Toque no 🎤, fale 2–3 segundos e toque de novo para parar.',
          )
        }
      }

      // Sem timeslice — Android grava tudo num blob ao parar (mais fiável).
      recorder.start()
      setListening(true)

      maxTimerRef.current = window.setTimeout(() => {
        stopWhisperRecording()
      }, MAX_RECORD_SECONDS * 1000)

      return true
    } catch (err) {
      setMicReady(false)
      stopStream()
      setListening(false)
      const result: MicAccessResult = {
        ok: false,
        state: 'denied',
        errorName: err instanceof DOMException ? err.name : 'UnknownError',
      }
      setMicError(micFailureMessage(result, isStandalonePwa()) || micErrorFromException(err))
      return false
    }
  }, [finishWhisper, stopStream, stopWhisperRecording])

  const startBrowser = useCallback(async (onFinal: (text: string) => void): Promise<boolean> => {
    setMicError(null)
    const Ctor = getSpeechRecognition()
    if (!Ctor) return false

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicReady(true)
    } catch (err) {
      setMicReady(false)
      setMicError(micErrorFromException(err))
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

      if (currentMode === 'whisper') {
        await startWhisper()
        return
      }

      if (currentMode === 'browser') {
        await startBrowser(onFinal)
        return
      }

      const settings = loadGfOpenAiSettings()
      if (isStandalonePwa()) {
        setMicError('No app instalado o microfone falha muitas vezes. Use «Abrir no Chrome» abaixo.')
      } else if (canRecordAudio() && (!settings.enabled || !settings.apiKey.trim())) {
        setMicError('Para falar no celular: Uso da API → cole a chave → Ativar IA → Guardar.')
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
    micReady,
    micError,
    micHelpLines:
      micError != null
        ? micPermissionHelpLines(detectMicPlatform(), isStandalonePwa())
        : null,
    isStandalonePwa: isStandalonePwa(),
    isMobile: isMobileDevice(),
    openInBrowser: openVoiceInSystemBrowser,
    toggle,
    clearError: () => setMicError(null),
  }
}
