'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { GF_FOCUS_PHRASE_EVENT } from '@/lib/gestao-financeira/voice-bridge'
import { cn } from '@/lib/utils'
import { Mic, Square } from 'lucide-react'

type Props = {
  value: string
  onChange: (value: string) => void
  inputRef?: RefObject<HTMLTextAreaElement | null>
  className?: string
  /** Microfone do app (Web Speech). */
  listening?: boolean
  micSupported?: boolean
  onMicClick?: () => void
}

export function GfPhraseInput({
  value,
  onChange,
  inputRef,
  className,
  listening = false,
  micSupported = true,
  onMicClick,
}: Props) {
  const internalRef = useRef<HTMLTextAreaElement>(null)
  const ref = inputRef ?? internalRef

  useEffect(() => {
    const onFocus = () => {
      ref.current?.focus()
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    window.addEventListener(GF_FOCUS_PHRASE_EVENT, onFocus)
    return () => window.removeEventListener(GF_FOCUS_PHRASE_EVENT, onFocus)
  }, [ref])

  return (
    <div className="relative">
      <textarea
        ref={ref}
        className={cn(
          'min-h-[80px] w-full rounded-lg border border-border/60 bg-background/80 py-2 pl-3 pr-14 text-sm',
          listening && 'border-red-500/50 ring-1 ring-red-500/30',
          className,
        )}
        placeholder="Ex.: Gastei 80 no mercado · Adicionei 500 · Quanto tenho no caixa?"
        value={value}
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="on"
        spellCheck
        onChange={(e) => onChange(e.target.value)}
      />
      {onMicClick ? (
        <Button
          type="button"
          size="icon"
          variant={listening ? 'destructive' : 'secondary'}
          className={cn(
            'absolute bottom-2 right-2 h-12 w-12 shrink-0 rounded-full shadow-md sm:h-10 sm:w-10',
            listening && 'animate-pulse',
          )}
          aria-label={listening ? 'Parar de ouvir' : 'Falar frase'}
          title={
            micSupported
              ? listening
                ? 'Parar'
                : 'Toque e fale'
              : 'Use o microfone do teclado do celular'
          }
          onClick={onMicClick}
        >
          {listening ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
        </Button>
      ) : null}
    </div>
  )
}
