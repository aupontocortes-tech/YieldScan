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
import { Badge } from '@/components/ui/badge'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
import { GfBrowserVoiceButton } from '@/components/gestao-financeira/gf-browser-voice-button'
import { isStandalonePwa } from '@/lib/mic-permission'
import { parseGfVoiceText } from '@/lib/gestao-financeira/voice-parser'
import type { GfParsedVoiceEntry } from '@/lib/gestao-financeira/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (parsed: GfParsedVoiceEntry) => Promise<void>
}

export function GfVoiceDialog({ open, onOpenChange, onConfirm }: Props) {
  const { supported, listening, transcript, error, micReady, start, stop, setTranscript } =
    useSpeechRecognition()
  const [parsed, setParsed] = useState<GfParsedVoiceEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [requestingMic, setRequestingMic] = useState(false)
  const [manual, setManual] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const installedApp = typeof window !== 'undefined' && isStandalonePwa()
  const showBrowserCta = installedApp

  useEffect(() => {
    if (!open) {
      stop()
      setParsed(null)
      setManual('')
      setTranscript('')
      return
    }
    const t = window.setTimeout(() => textareaRef.current?.focus(), 150)
    return () => window.clearTimeout(t)
  }, [open, stop, setTranscript])

  useEffect(() => {
    const text = manual.trim() || transcript.trim()
    setParsed(text ? parseGfVoiceText(text) : null)
  }, [transcript, manual])

  const handleAllowAndRecord = async () => {
    setRequestingMic(true)
    try {
      await start(true)
    } finally {
      setRequestingMic(false)
    }
  }

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
            Registrar rápido
          </DialogTitle>
          <DialogDescription>
            {installedApp
              ? 'Digite abaixo (sempre funciona). Para microfone, use o botão azul.'
              : 'Digite a frase abaixo — funciona sem microfone. Ex.: «Ontem gastei 50 de mercado».'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            className="min-h-[88px] w-full rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
            placeholder="Ontem gastei 50 reais de mercado"
            value={manual || transcript}
            onChange={(e) => {
              setManual(e.target.value)
              setTranscript('')
            }}
          />

          {showBrowserCta ? (
            <GfBrowserVoiceButton size="lg" />
          ) : null}

          {!installedApp && supported ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border/40 bg-muted/15 p-3">
              <p className="text-xs text-muted-foreground">Opcional — microfone:</p>
              {!micReady ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={requestingMic}
                  onClick={() => void handleAllowAndRecord()}
                >
                  {requestingMic ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                  Permitir microfone
                </Button>
              ) : null}
              <Button
                type="button"
                variant={listening ? 'destructive' : 'outline'}
                className="w-full gap-2"
                onClick={() => (listening ? stop() : void start(!micReady))}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {listening ? 'Parar gravação' : micReady ? 'Gravar voz' : 'Gravar voz (pede permissão)'}
              </Button>
            </div>
          ) : null}

          {error ? <p className="text-xs text-amber-200/90">{error}</p> : null}

          {parsed ? (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 p-3 text-sm space-y-2">
              <p className="font-medium text-emerald-200">Confirmar antes de salvar:</p>
              <p className="text-foreground">{parsed.summary}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{parsed.type === 'income' ? 'Receita' : parsed.type === 'expense' ? 'Despesa' : 'Transferência'}</Badge>
                <Badge className="bg-emerald-600">R$ {parsed.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Badge>
                {parsed.categoryName ? <Badge variant="secondary">{parsed.categoryName}</Badge> : null}
                {parsed.cashBoxName ? <Badge variant="outline">{parsed.cashBoxName}</Badge> : null}
                {parsed.toCashBoxName ? <Badge variant="outline">→ {parsed.toCashBoxName}</Badge> : null}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Fale, grave ou digite para ver a confirmação.</p>
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
