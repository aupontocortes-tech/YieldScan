'use client'

import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff } from 'lucide-react'
import { GF_FOCUS_PHRASE_EVENT, GF_START_APP_MIC_EVENT } from '@/lib/gestao-financeira/voice-bridge'
import { prefersKeyboardDictation } from '@/lib/gestao-financeira/voice-input-mode'
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
  const keyboardMode = prefersKeyboardDictation()

  const focusField = useCallback(() => {
    ref.current?.focus()
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [ref])

  const mic = useGfMicrophone({
    onTranscript: (text) => {
      onChange(text)
      focusField()
    },
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

  return (
    <div className={cn('space-y-2', className)}>
      {keyboardMode ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/15 px-3 py-2.5 text-xs text-muted-foreground">
          <p className="mb-1.5 font-medium text-emerald-200/90">Três formas grátis</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              <strong className="text-foreground">Microfone verde</strong> — tenta gravar pelo app (quando o
              navegador permitir)
            </li>
            <li>
              <strong className="text-foreground">Teclado</strong> — toque no campo → ícone 🎤 do teclado → fale
            </li>
            <li>
              <strong className="text-foreground">Digitar</strong> — escreva a frase no campo
            </li>
          </ol>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          size="icon"
          className={cn(
            'h-11 w-11 shrink-0',
            mic.recording ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500',
          )}
          aria-label={mic.recording ? 'Parar gravação' : 'Falar pelo microfone do app'}
          onClick={() => void mic.toggle()}
        >
          {mic.recording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <textarea
          ref={ref}
          className="min-h-[72px] flex-1 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm"
          placeholder="Fale, use o microfone do teclado ou digite: Ontem gastei 50 de mercado"
          value={value}
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="on"
          spellCheck
          onChange={(e) => onChange(e.target.value)}
        />
      </div>

      {mic.recording ? (
        <p className="text-xs text-red-300/90">Ouvindo… toque no microfone verde outra vez para parar.</p>
      ) : null}

      {mic.hint ? <p className="text-xs text-emerald-200/90">{mic.hint}</p> : null}
      {mic.error && !mic.hint ? <p className="text-xs text-amber-200/90">{mic.error}</p> : null}
    </div>
  )
}
