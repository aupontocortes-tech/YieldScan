'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  checkGfOpenAiLimits,
  loadGfOpenAiSettings,
} from '@/lib/gestao-financeira/openai-config'
import {
  createAudioRecorder,
  MIN_AUDIO_BLOB_BYTES,
  recordingTimesliceMs,
} from '@/lib/gestao-financeira/mic-recorder'
import { transcribeGfVoiceWithOpenAi } from '@/lib/gestao-financeira/transcribe-with-openai'
import { isStandalonePwa, openVoiceInSystemBrowser } from '@/lib/mic-permission'

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
const MIN_RECORD_MS = 400

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

/** Chamado de forma síncrona no toque — abre o aviso do navegador. */
export function requestMicStreamSync(): Promise<MediaStream> | null {
  if (!canRecordAudio()) return null
  return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
}

function resolveSpeechMode(preferRealtime?: boolean): GfSpeechMode {
  if (preferRealtime && getSpeechRecognition()) return 'browser'
  const settings = loadGfOpenAiSettings()
  const openAiReady = settings.enabled && settings.apiKey.trim()

  if (openAiReady && canRecordAudio()) return 'whisper'
  if (getSpeechRecognition()) return 'browser'
  return 'none'
}

function micErrorFromException(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') return 'Microfone bloqueado.'
    if (err.name === 'NotFoundError') return 'Microfone não encontrado.'
    if (err.name === 'NotReadableError') return 'Microfone em uso.'
  }
  return 'Erro no microfone.'
}

function releaseStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop())
}

function prepareStream(stream: MediaStream): MediaStream {
  for (const t of stream.getAudioTracks()) t.enabled = true
  return stream
}

/** Monta o texto a mostrar sem repetir segmentos finais iguais ou cumulativos (bug comum no Chrome). */
function mergeFinalParts(parts: string[]): string {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!.trim()

  const trimmed = parts.map((p) => p.trim()).filter(Boolean)
  if (trimmed.length === 0) return ''
  if (trimmed.every((p) => p === trimmed[0])) return trimmed[0]!

  const last = trimmed[trimmed.length - 1]!
  const cumulative = trimmed.every((part, i) => {
    if (i === 0) return true
    const prev = trimmed[i - 1]!
    return last.includes(part) || last.includes(prev) || part.startsWith(prev)
  })
  if (cumulative) return last

  return trimmed.join('')
}

function buildSpeechDisplay(
  results: SpeechRecognitionEventLike['results'],
): string {
  const finalParts: string[] = []
  let interim = ''
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!
    const piece = result[0]!.transcript
    if (result.isFinal) finalParts.push(piece)
    else interim = piece
  }

  const stable = mergeFinalParts(finalParts)
  return (stable + interim).trim()
}

export function useGfSpeechInput(opts?: { preferRealtime?: boolean }) {
  const preferRealtime = opts?.preferRealtime ?? false
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [requestingPermission, setRequestingPermission] = useState(false)
  const [mode, setMode] = useState<GfSpeechMode>('none')
  const [micError, setMicError] = useState<string | null>(null)

  const recRef = useRef<SpeechRecognitionInstance | null>(null)
  const sessionIdRef = useRef(0)
  const listeningRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordStartRef = useRef(0)
  const maxTimerRef = useRef<number | null>(null)
  const onFinalRef = useRef<(text: string) => void>(() => {})
  const onInterimRef = useRef<(text: string) => void>(() => {})
  const lastTranscriptRef = useRef('')
  const finalDeliveredRef = useRef(false)

  const setListeningState = useCallback((active: boolean) => {
    listeningRef.current = active
    setListening(active)
  }, [])

  const deliverFinal = useCallback(() => {
    if (finalDeliveredRef.current) return
    const final = lastTranscriptRef.current.trim()
    if (!final) return
    finalDeliveredRef.current = true
    onFinalRef.current(final)
  }, [])

  const teardownBrowserRec = useCallback((rec: SpeechRecognitionInstance | null) => {
    if (!rec) return
    rec.onresult = null
    rec.onerror = null
    rec.onend = null
    try {
      rec.abort()
    } catch {
      /* ignore */
    }
    if (recRef.current === rec) recRef.current = null
  }, [])

  useEffect(() => {
    setMode(resolveSpeechMode(preferRealtime))
    return () => {
      teardownBrowserRec(recRef.current)
      stopWhisperRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferRealtime, teardownBrowserRec])

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
      setListeningState(false)
    }
  }, [stopStream, setListeningState])

  const finishWhisper = useCallback(async (blob: Blob, durationSeconds: number) => {
    setTranscribing(true)
    try {
      const { text, error } = await transcribeGfVoiceWithOpenAi(blob, durationSeconds)
      if (text) onFinalRef.current(text)
      else if (error) setMicError(error)
    } finally {
      setTranscribing(false)
      setListeningState(false)
    }
  }, [setListeningState])

  const beginWhisperRecording = useCallback(
    (stream: MediaStream) => {
      const active = prepareStream(stream)
      if (active.getAudioTracks().length === 0) {
        releaseStream(active)
        setMicError('Microfone não encontrado.')
        return
      }

      streamRef.current = active
      chunksRef.current = []
      recordStartRef.current = Date.now()

      const { recorder, mime } = createAudioRecorder(active)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }

      recorder.onerror = () => {
        setMicError('Erro ao gravar áudio.')
        stopStream()
        setListeningState(false)
      }

      recorder.onstop = () => {
        const durationSeconds = Math.max(1, (Date.now() - recordStartRef.current) / 1000)
        const blobType = recorder.mimeType || mime || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: blobType })
        chunksRef.current = []
        mediaRecorderRef.current = null
        stopStream()

        const elapsedMs = Date.now() - recordStartRef.current
        if (blob.size < MIN_AUDIO_BLOB_BYTES || elapsedMs < MIN_RECORD_MS) {
          setListeningState(false)
          return
        }

        void finishWhisper(blob, durationSeconds)
      }

      const timeslice = recordingTimesliceMs()
      if (timeslice != null) recorder.start(timeslice)
      else recorder.start()

      setListeningState(true)

      maxTimerRef.current = window.setTimeout(() => {
        stopWhisperRecording()
      }, MAX_RECORD_SECONDS * 1000)
    },
    [finishWhisper, stopStream, stopWhisperRecording, setListeningState],
  )

  const finishBrowserSession = useCallback(
    (sessionId: number, rec: SpeechRecognitionInstance) => {
      if (sessionId !== sessionIdRef.current) return
      teardownBrowserRec(rec)
      setListeningState(false)
      deliverFinal()
    },
    [deliverFinal, setListeningState, teardownBrowserRec],
  )

  const startBrowser = useCallback((onFinal: (text: string) => void, stream: MediaStream): boolean => {
    setMicError(null)
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      releaseStream(stream)
      return false
    }

    releaseStream(stream)

    teardownBrowserRec(recRef.current)

    const sessionId = ++sessionIdRef.current
    const rec = new Ctor()
    rec.lang = 'pt-BR'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    lastTranscriptRef.current = ''
    finalDeliveredRef.current = false
    setListeningState(true)

    rec.onresult = (ev) => {
      if (sessionId !== sessionIdRef.current) return
      const display = buildSpeechDisplay(ev.results)
      if (!display) return
      lastTranscriptRef.current = display
      onInterimRef.current(display)
    }

    rec.onerror = (ev) => {
      if (sessionId !== sessionIdRef.current) return
      if (ev.error === 'aborted' || ev.error === 'no-speech') return
      setMicError(ev.error === 'not-allowed' ? 'Microfone bloqueado.' : `Erro: ${ev.error}`)
    }

    rec.onend = () => {
      if (sessionId !== sessionIdRef.current) return
      if (listeningRef.current) {
        try {
          rec.start()
          return
        } catch {
          /* sessão encerrada pelo utilizador */
        }
      }
      finishBrowserSession(sessionId, rec)
    }

    recRef.current = rec
    try {
      rec.start()
      return true
    } catch {
      finishBrowserSession(sessionId, rec)
      setMicError('Erro no microfone.')
      return false
    }
  }, [deliverFinal, finishBrowserSession, setListeningState, teardownBrowserRec])

  const stopBrowser = useCallback(() => {
    setListeningState(false)
    const rec = recRef.current
    if (!rec) {
      deliverFinal()
      return
    }
    try {
      rec.stop()
    } catch {
      finishBrowserSession(sessionIdRef.current, rec)
    }
  }, [deliverFinal, finishBrowserSession, setListeningState])

  const continueWithStream = useCallback(
    (stream: MediaStream, onFinal: (text: string) => void) => {
      const currentMode = resolveSpeechMode(preferRealtime)
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
      setMicError('Configure Uso da API.')
    },
    [beginWhisperRecording, startBrowser, preferRealtime],
  )

  const toggle = useCallback(
    (
      onFinal: (text: string) => void,
      micPromise?: Promise<MediaStream> | null,
      onInterim?: (text: string) => void,
    ) => {
      onFinalRef.current = onFinal
      onInterimRef.current = onInterim ?? (() => {})
      const currentMode = resolveSpeechMode(preferRealtime)
      setMode(currentMode)

      if (listeningRef.current || transcribing) {
        if (currentMode === 'whisper') stopWhisperRecording()
        else stopBrowser()
        return
      }

      if (!canRecordAudio()) {
        setMicError('Microfone indisponível.')
        return
      }

      setMicError(null)
      setListeningState(true)

      const streamPromise = micPromise ?? requestMicStreamSync()
      if (!streamPromise) {
        setMicError('Microfone indisponível.')
        return
      }

      setRequestingPermission(true)

      void streamPromise
        .then((stream) => {
          setRequestingPermission(false)
          continueWithStream(prepareStream(stream), onFinal)
        })
        .catch((err: unknown) => {
          setRequestingPermission(false)
          setListeningState(false)
          if (
            isStandalonePwa() &&
            err instanceof DOMException &&
            (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
          ) {
            openVoiceInSystemBrowser()
            return
          }
          setMicError(micErrorFromException(err))
        })
    },
    [transcribing, continueWithStream, stopBrowser, stopWhisperRecording, preferRealtime, setListeningState],
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
