'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { parseGfVoiceText } from '@/lib/gestao-financeira/voice-parser'
import { saveGfParsedVoiceEntry } from '@/lib/gestao-financeira/save-parsed-voice'
import { dispatchGfVoiceOpen } from '@/lib/gestao-financeira/voice-bridge'
import { Loader2, Mic, PenLine } from 'lucide-react'

/** Registro por texto — funciona sempre, sem permissão de microfone. */
export function GfQuickRegister() {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const parsed = text.trim() ? parseGfVoiceText(text.trim()) : null

  const handleSave = async () => {
    if (!parsed) return
    setSaving(true)
    try {
      const ok = await saveGfParsedVoiceEntry(parsed)
      if (ok) setText('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/35 to-teal-950/15 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/90 text-white">
          <PenLine className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">Registrar em uma frase</h3>
          <p className="text-xs text-muted-foreground">
            Digite abaixo — funciona sempre, sem microfone. Ex.: &quot;Ontem gastei 50 de mercado&quot;
          </p>
        </div>
      </div>

      <textarea
        className="min-h-[72px] w-full rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm"
        placeholder="Ontem gastei 50 reais de mercado"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {parsed ? (
        <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-950/20 p-3 text-sm space-y-2">
          <p className="font-medium text-emerald-200">Confirmar:</p>
          <p className="text-foreground">{parsed.summary}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {parsed.type === 'income' ? 'Receita' : parsed.type === 'expense' ? 'Despesa' : 'Transferência'}
            </Badge>
            <Badge className="bg-emerald-600">
              R$ {parsed.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Badge>
            {parsed.categoryName ? <Badge variant="secondary">{parsed.categoryName}</Badge> : null}
          </div>
        </div>
      ) : text.trim() ? (
        <p className="mt-2 text-xs text-amber-200/90">Inclua valor e tipo — ex.: gastei 30, recebi 500 salário.</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500"
          disabled={!parsed || saving}
          onClick={() => void handleSave()}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar
        </Button>
        <Button type="button" variant="outline" className="gap-2" onClick={() => dispatchGfVoiceOpen()}>
          <Mic className="h-4 w-4" />
          Microfone
        </Button>
      </div>
    </div>
  )
}
