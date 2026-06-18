'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Mic, Square } from 'lucide-react'
import { GF_FOCUS_PHRASE_EVENT, GF_START_APP_MIC_EVENT } from '@/lib/gestao-financeira/voice-bridge'
import { GfMicConnectDialog } from '@/components/gestao-financeira/gf-mic-connect-dialog'
import { useGfMicrophone } from '@/hooks/use-gf-microphone'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (value: string) => void
  inputRef?: RefObject<HTMLTextAreaElement | null>
  className?: string
}

export function GfPhraseInput({ value, onChange, inputRef, className }: Props) {
  const internalRef = useRef<HTMLTextAreaElement>(null)
  const ref = inputRef ?? internalRef
  const holdingRef = useRef(false)
  const eventStartedRef = useRef(false)
  const [connectOpen, setConnectOpen] = useState(false)

  const focusField = useCallback(() => {
    ref.current?.focus()
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [ref])

  const mic = useGfMicrophone({
    onTranscript: (text) => onChange(text),
    onFocusKeyboard: focusField,
  })

  const openConnect = useCallback(() => {
    focusField()
    setConnectOpen(true)
  }, [focusField])

  const beginHold = useCallback(() => {
    if (holdingRef.current) return
    if (!mic.micReady) {
      openConnect()
      return
    }
    holdingRef.current = true
    eventStartedRef.current = false
    focusField()
    void mic.startListening()
  }, [focusField, mic, openConnect])

  const startFromEvent = useCallback(() => {
    if (!mic.micReady) {
      openConnect()
      return
    }
    eventStartedRef.current = true
    holdingRef.current = false
    focusField()
    void mic.startListening()
  }, [focusField, mic, openConnect])

  const endHold = useCallback(() => {
    if (holdingRef.current) {
      holdingRef.current = false
      mic.stopListening()
      return
    }
    if (eventStartedRef.current && mic.recording) {
      eventStartedRef.current = false
      mic.stopListening()
    }
  }, [mic])

  useEffect(() => {
    const onFocus = () => focusField()
    const onStartMic = () => startFromEvent()
    window.addEventListener(GF_FOCUS_PHRASE_EVENT, onFocus)
    window.addEventListener(GF_START_APP_MIC_EVENT, onStartMic)
    return () => {
      window.removeEventListener(GF_FOCUS_PHRASE_EVENT, onFocus)
      window.removeEventListener(GF_START_APP_MIC_EVENT, onStartMic)
    }
  }, [focusField, startFromEvent])

  const active = mic.recording || mic.requesting
  const label = mic.requesting
    ? 'Permita o microfone…'
    : mic.recording
      ? eventStartedRef.current && !holdingRef.current
        ? 'Ouvindo… toque para parar'
        : 'Ouvindo… solte para parar'
      : mic.micReady
        ? 'Segure para falar'
        : 'Toque para conectar microfone'

  return (
    <div className={cn('space-y-2', className)}>
      <button
        type="button"
        aria-pressed={active}
        aria-label={label}
        className={cn(
          'flex w-full select-none items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors touch-none',
          mic.requesting
            ? 'bg-amber-600 hover:bg-amber-500'
            : mic.recording
              ? 'bg-red-600 hover:bg-red-500'
              : 'bg-emerald-600 hover:bg-emerald-500',
        )}
        onClick={() => {
          if (!mic.micReady && !mic.recording) openConnect()
        }}
        onPointerDown={(e) => {
          e.preventDefault()
          if (!mic.micReady) return
          if (eventStartedRef.current && mic.recording) {
            endHold()
            return
          }
          beginHold()
        }}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
      >
        <span className="relative flex h-6 w-6 items-center justify-center">
          {mic.recording ? (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/40" />
              <Square className="h-4 w-4 fill-current" />
            </>
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </span>
        {label}
      </button>

      <textarea
        ref={ref}
        className="min-h-[72px] w-full rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm"
        placeholder="Segure o botão e fale, ou digite: Ontem gastei 50 de mercado"
        value={value}
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="on"
        spellCheck
        onChange={(e) => onChange(e.target.value)}
      />

      {mic.requesting ? (
        <p className="text-xs text-amber-200/90">
          O Chrome vai pedir permissão de microfone — toque em <strong>Permitir</strong>.
        </p>
      ) : mic.recording ? (
        <p className="text-xs text-red-300/90">Fale agora e solte o botão quando terminar.</p>
      ) : mic.hint ? (
        <p className="text-xs text-emerald-200/90">{mic.hint}</p>
      ) : mic.error ? (
        <p className="text-xs text-amber-200/90">{mic.error}</p>
      ) : !mic.micReady ? (
        <p className="text-[11px] text-muted-foreground">
          Toque no botão verde para abrir a conexão do microfone com o Chrome.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Microfone conectado — segure o botão verde e fale. Também pode digitar no campo.
        </p>
      )}

      <GfMicConnectDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        requesting={mic.requesting}
        error={mic.error}
        onAllow={mic.requestPermission}
      />
    </div>
  )
}
