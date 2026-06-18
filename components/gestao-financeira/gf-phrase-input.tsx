'use client'

import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { Mic, Square } from 'lucide-react'
import { GF_FOCUS_PHRASE_EVENT, GF_START_APP_MIC_EVENT } from '@/lib/gestao-financeira/voice-bridge'
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

  const focusField = useCallback(() => {
    ref.current?.focus()
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [ref])

  const mic = useGfMicrophone({
    onTranscript: (text) => onChange(text),
    onFocusKeyboard: focusField,
  })

  useEffect(() => {
    const onFocus = () => focusField()
    const onStartMic = () => {
      focusField()
      void mic.toggle()
    }
    window.addEventListener(GF_FOCUS_PHRASE_EVENT, onFocus)
    window.addEventListener(GF_START_APP_MIC_EVENT, onStartMic)
    return () => {
      window.removeEventListener(GF_FOCUS_PHRASE_EVENT, onFocus)
      window.removeEventListener(GF_START_APP_MIC_EVENT, onStartMic)
    }
  }, [focusField, mic])

  const recording = mic.recording

  return (
    <div className={cn('space-y-2', className)}>
      <button
        type="button"
        onClick={() => void mic.toggle()}
        aria-pressed={recording}
        aria-label={recording ? 'Parar de ouvir' : 'Falar pelo microfone'}
        className={cn(
          'flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors',
          recording ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500',
        )}
      >
        <span className="relative flex h-6 w-6 items-center justify-center">
          {recording ? (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/40" />
              <Square className="h-4 w-4 fill-current" />
            </>
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </span>
        {recording ? 'Ouvindo… toque para parar' : 'Falar'}
      </button>

      <textarea
        ref={ref}
        className="min-h-[72px] w-full rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm"
        placeholder="Toque em Falar e diga, use o microfone do teclado, ou digite: Ontem gastei 50 de mercado"
        value={value}
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="on"
        spellCheck
        onChange={(e) => onChange(e.target.value)}
      />

      {recording ? (
        <p className="text-xs text-red-300/90">Fale agora. Ao terminar, toque no botão vermelho para parar.</p>
      ) : mic.hint ? (
        <p className="text-xs text-emerald-200/90">{mic.hint}</p>
      ) : mic.error ? (
        <p className="text-xs text-amber-200/90">{mic.error}</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          No celular, se o botão Falar não ouvir, toque no campo e use o microfone do teclado.
        </p>
      )}
    </div>
  )
}
