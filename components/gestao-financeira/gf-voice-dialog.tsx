'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Mic, Loader2 } from 'lucide-react'
import { GfParsedPreview } from '@/components/gestao-financeira/gf-parsed-preview'
import { GfPhraseInput } from '@/components/gestao-financeira/gf-phrase-input'
import { parseGfVoiceText } from '@/lib/gestao-financeira/voice-parser'
import type { GfParsedVoiceEntry } from '@/lib/gestao-financeira/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (parsed: GfParsedVoiceEntry) => Promise<void>
}

export function GfVoiceDialog({ open, onOpenChange, onConfirm }: Props) {
  const [parsed, setParsed] = useState<GfParsedVoiceEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [manual, setManual] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) {
      setParsed(null)
      setManual('')
      return
    }
    const t = window.setTimeout(() => textareaRef.current?.focus(), 150)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    setParsed(manual.trim() ? parseGfVoiceText(manual.trim()) : null)
  }, [manual])

  const handleSave = async () => {
    if (!parsed) return
    setSaving(true)
    try {
      await onConfirm(parsed)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-emerald-500/20 bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-emerald-400" />
            Falar ou digitar
          </DialogTitle>
          <DialogDescription>
            Grátis: microfone verde, microfone do teclado ou digite no campo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <GfPhraseInput value={manual} onChange={setManual} inputRef={textareaRef} />

          {parsed ? (
            <GfParsedPreview parsed={parsed} title="Confirmar antes de salvar:" />
          ) : (
            <p className="text-xs text-muted-foreground">Fale pelo microfone ou digite para ver a confirmação.</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!parsed || saving} onClick={() => void handleSave()} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
