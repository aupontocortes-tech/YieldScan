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
import { isStandalonePwa } from '@/lib/mic-permission'
import { parseGfVoiceText } from '@/lib/gestao-financeira/voice-parser'
import type { GfParsedVoiceEntry } from '@/lib/gestao-financeira/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (parsed: GfParsedVoiceEntry) => Promise<void>
  autoStartMic?: boolean
}

export function GfVoiceDialog({ open, onOpenChange, onConfirm, autoStartMic }: Props) {
  const { supported, listening, transcript, error, start, stop, setTranscript } = useSpeechRecognition()
  const [parsed, setParsed] = useState<GfParsedVoiceEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [manual, setManual] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoStartedRef = useRef(false)
  const installedApp = typeof window !== 'undefined' && isStandalonePwa()

  useEffect(() => {
    if (!open) {
      stop()
      setParsed(null)
      setManual('')
      setTranscript('')
      autoStartedRef.current = false
      return
    }
    const t = window.setTimeout(() => textareaRef.current?.focus(), 150)
    if (autoStartedRef.current) return
    autoStartedRef.current = true
    if (autoStartMic && supported && !installedApp) {
      window.setTimeout(() => start(), 300)
    }
    return () => window.clearTimeout(t)
  }, [open, autoStartMic, supported, installedApp, start, stop, setTranscript])

  useEffect(() => {
    const text = manual.trim() || transcript.trim()
    setParsed(text ? parseGfVoiceText(text) : null)
  }, [transcript, manual])

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
            Registrar despesa ou receita
          </DialogTitle>
          <DialogDescription>
            {installedApp
              ? 'No app instalado, digitar é o mais fácil. Escreva abaixo ou toque em Gravar voz.'
              : 'Digite ou fale. Ex.: «Ontem gastei 50 reais de mercado».'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            className="min-h-[100px] w-full rounded-lg border border-emerald-500/30 bg-muted/30 px-3 py-2 text-sm"
            placeholder="Ex: Ontem gastei 50 reais de mercado"
            value={manual || transcript}
            onChange={(e) => {
              setManual(e.target.value)
              setTranscript('')
            }}
          />

          {supported ? (
            <Button
              type="button"
              variant={listening ? 'destructive' : 'outline'}
              className="w-full gap-2"
              onClick={() => (listening ? stop() : start())}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {listening ? 'Parar gravação' : 'Gravar voz (opcional)'}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Voz indisponível aqui — use o campo acima.</p>
          )}

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
              {parsed.confidence === 'low' ? (
                <p className="text-xs text-amber-200/90">Confiança baixa — confira valor e tipo antes de salvar.</p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Digite um valor e descrição para ver a confirmação.</p>
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
