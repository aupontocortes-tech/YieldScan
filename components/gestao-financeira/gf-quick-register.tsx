'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { GfParsedPreview } from '@/components/gestao-financeira/gf-parsed-preview'
import { GfPhraseInput } from '@/components/gestao-financeira/gf-phrase-input'
import { parseGfVoiceText } from '@/lib/gestao-financeira/voice-parser'
import { saveGfParsedVoiceEntry } from '@/lib/gestao-financeira/save-parsed-voice'
import { Loader2, PenLine } from 'lucide-react'

/** Registro por frase — digitar ou falar pelo microfone do teclado. */
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
            Digite ou fale pelo teclado. Ex.: «Ontem gastei 50 de mercado»
          </p>
        </div>
      </div>

      <GfPhraseInput value={text} onChange={setText} />

      {parsed ? (
        <div className="mt-3">
          <GfParsedPreview parsed={parsed} />
        </div>
      ) : text.trim() ? (
        <p className="mt-2 text-xs text-amber-200/90">Inclua valor e tipo — ex.: gastei 30, recebi 500 salário.</p>
      ) : null}

      <Button
        type="button"
        className="mt-3 w-full gap-2 bg-emerald-600 hover:bg-emerald-500"
        disabled={!parsed || saving}
        onClick={() => void handleSave()}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Salvar
      </Button>
    </div>
  )
}
