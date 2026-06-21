'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { GF_FOCUS_PHRASE_EVENT } from '@/lib/gestao-financeira/voice-bridge'
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

  useEffect(() => {
    const onFocus = () => {
      ref.current?.focus()
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    window.addEventListener(GF_FOCUS_PHRASE_EVENT, onFocus)
    return () => window.removeEventListener(GF_FOCUS_PHRASE_EVENT, onFocus)
  }, [ref])

  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[80px] w-full rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm',
        className,
      )}
      placeholder="Ex.: Ganhei 500 · Gastei 80 no mercado · Guardei 200 · Aportei 1000 nos investimentos"
      value={value}
      enterKeyHint="done"
      autoComplete="off"
      autoCorrect="on"
      spellCheck
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
