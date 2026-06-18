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

  const handleMicTap = useCallback(() => {
    if (!mic.webspeech) {
      focusField()
      return
    }
    if (!mic.micReady) {
      openConnect()
      return
    }
    if (mic.recording) {
      mic.stopListening()
      return
    }
    void mic.startListening()
  }, [focusField, mic, openConnect])

  useEffect(() => {
    const onFocus = () => focusField()
    const onStartMic = () => handleMicTap()
    window.addEventListener(GF_FOCUS_PHRASE_EVENT, onFocus)
    window.addEventListener(GF_START_APP_MIC_EVENT, onStartMic)
    return () => {
      window.removeEventListener(GF_FOCUS_PHRASE_EVENT, onFocus)
      window.removeEventListener(GF_START_APP_MIC_EVENT, onStartMic)
    }
  }, [focusField, handleMicTap])

  const label = mic.requesting
    ? 'A ligar microfone…'
    : mic.recording
      ? 'Ouvindo… toque para parar'
      : !mic.webspeech
        ? 'Voz indisponível — use o teclado'
        : mic.micReady
          ? 'Toque para falar'
          : 'Toque para conectar microfone'

  return (
    <div className={cn('space-y-2', className)}>
      <button
        type="button"
        aria-pressed={mic.recording || mic.requesting}
        aria-label={label}
        className={cn(
          'flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors',
          mic.requesting
            ? 'bg-amber-600 hover:bg-amber-500'
            : mic.recording
              ? 'bg-red-600 hover:bg-red-500'
              : 'bg-emerald-600 hover:bg-emerald-500',
        )}
        onClick={handleMicTap}
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
        placeholder="Toque em Falar, diga a frase, toque de novo para parar — ou digite aqui"
        value={value}
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="on"
        spellCheck
        onChange={(e) => onChange(e.target.value)}
      />

      {mic.requesting ? (
        <p className="text-xs text-amber-200/90">A ligar ao microfone…</p>
      ) : mic.recording ? (
        <p className="text-xs text-red-300/90">Fale agora. Quando terminar, toque no botão vermelho.</p>
      ) : !mic.webspeech ? (
        <p className="text-xs text-amber-200/90">
          Este navegador não suporta voz pelo app. Toque no campo e use o <strong>microfone do teclado</strong>.
        </p>
      ) : mic.hint ? (
        <p className="text-xs text-emerald-200/90">{mic.hint}</p>
      ) : mic.error ? (
        <p className="text-xs text-amber-200/90">{mic.error}</p>
      ) : mic.micReady ? (
        <p className="text-[11px] text-muted-foreground">
          Microfone permitido — toque em <strong className="text-foreground">Falar</strong>, diga a frase e toque de
          novo para parar.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Toque no botão verde para permitir o microfone no Chrome.
        </p>
      )}

      <GfMicConnectDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        requesting={mic.requesting}
        error={mic.error}
        webspeech={mic.webspeech}
        onAllow={mic.requestPermission}
      />
    </div>
  )
}
