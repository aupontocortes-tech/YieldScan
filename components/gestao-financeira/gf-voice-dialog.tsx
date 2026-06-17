'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { Mic, MicOff, Loader2, ShieldAlert } from 'lucide-react'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
import { micPermissionHelpLines } from '@/lib/mic-permission'
import { parseGfVoiceText } from '@/lib/gestao-financeira/voice-parser'
import type { GfParsedVoiceEntry } from '@/lib/gestao-financeira/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (parsed: GfParsedVoiceEntry) => Promise<void>
  /** Inicia gravação ao abrir (ex.: segurar botão Gestão no menu). */
  autoStartMic?: boolean
}

export function GfVoiceDialog({ open, onOpenChange, onConfirm, autoStartMic }: Props) {
  const {
    supported,
    listening,
    transcript,
    error,
    micReady,
    micState,
    micPlatform,
    start,
    stop,
    requestMic,
    setTranscript,
  } = useSpeechRecognition()
  const [parsed, setParsed] = useState<GfParsedVoiceEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [requestingMic, setRequestingMic] = useState(false)
  const [manual, setManual] = useState('')
  const autoStartedRef = useRef(false)
  const showMicHelp = !micReady && (micState === 'denied' || Boolean(error))
  const helpLines = micPermissionHelpLines(micPlatform)

  const handleAllowMic = useCallback(
    async (andStart = false) => {
      setRequestingMic(true)
      try {
        const ok = await requestMic()
        if (ok && andStart) await start()
        return ok
      } finally {
        setRequestingMic(false)
      }
    },
    [requestMic, start],
  )

  useEffect(() => {
    if (!open) {
      stop()
      setParsed(null)
      setManual('')
      setTranscript('')
      autoStartedRef.current = false
      return
    }
    if (autoStartedRef.current) return
    autoStartedRef.current = true
    void handleAllowMic(autoStartMic && supported)
  }, [open, autoStartMic, supported, stop, setTranscript, handleAllowMic])

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
            Registro por voz
          </DialogTitle>
          <DialogDescription>
            Voz <strong>100% grátis</strong> pelo navegador (Chrome/Edge). Fale naturalmente — o app organiza sozinho.
            Ex.: &quot;Comprei 89 reais de internet&quot;, &quot;Ganhei 3 mil de salário na carteira&quot;,
            &quot;Transferi 500 da principal para reserva&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!supported ? (
            <p className="text-sm text-amber-200/90">Microfone indisponível — use o campo de texto abaixo.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {!micReady ? (
                <Button
                  type="button"
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500"
                  disabled={requestingMic}
                  onClick={() => void handleAllowMic(true)}
                >
                  {requestingMic ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                  Permitir microfone
                </Button>
              ) : null}
              <Button
                type="button"
                variant={listening ? 'destructive' : 'default'}
                className="flex-1 gap-2"
                disabled={!micReady && micState === 'denied'}
                onClick={() => (listening ? stop() : void start())}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {listening ? 'Parar' : 'Gravar'}
              </Button>
            </div>
          )}

          {showMicHelp ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-sm space-y-2">
              <p className="flex items-center gap-2 font-medium text-amber-200">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                Como liberar o microfone
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                {helpLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                disabled={requestingMic}
                onClick={() => void handleAllowMic(false)}
              >
                Tentar novamente
              </Button>
            </div>
          ) : null}

          <textarea
            className="min-h-[88px] w-full rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
            placeholder="Ou digite aqui..."
            value={manual || transcript}
            onChange={(e) => {
              setManual(e.target.value)
              setTranscript('')
            }}
          />

          {error ? <p className="text-xs text-red-300">{error}</p> : null}

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
            <p className="text-xs text-muted-foreground">Nenhum valor identificado ainda.</p>
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
