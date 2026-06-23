'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { GfParsedPreview } from '@/components/gestao-financeira/gf-parsed-preview'
import { GfPhraseInput } from '@/components/gestao-financeira/gf-phrase-input'
import { useGestaoFinanceira } from '@/hooks/use-gestao-financeira'
import { useGfSpeechInput } from '@/hooks/use-gf-speech-input'
import { loadGfOpenAiSettings } from '@/lib/gestao-financeira/openai-config'
import {
  parseGfVoiceWithOpenAi,
  tryLocalBalanceQuery,
  type GfParseVoiceContext,
} from '@/lib/gestao-financeira/parse-with-openai'
import { saveGfParsedVoiceEntry } from '@/lib/gestao-financeira/save-parsed-voice'
import { parseGfVoiceText } from '@/lib/gestao-financeira/voice-parser'
import { GF_REQUEST_MIC_EVENT } from '@/lib/gestao-financeira/voice-bridge'
import type { GfVoiceParseResult } from '@/lib/gestao-financeira/types'
import { HelpCircle, Loader2, PenLine, Sparkles } from 'lucide-react'

function buildContext(gf: ReturnType<typeof useGestaoFinanceira>): GfParseVoiceContext {
  const cashBoxes = gf.cashBoxes.map((b) => ({ name: b.name, balance: b.balance }))
  const totalCashBrl = cashBoxes.reduce((s, b) => s + b.balance, 0)

  const cryptoHoldings = gf.cryptoHoldings.map((h) => {
    const price = gf.cryptoPrices[h.coinId]?.brl ?? 0
    const valueBrl = h.quantity * price
    return { symbol: h.symbol, quantity: h.quantity, valueBrl }
  })
  const totalCryptoBrl = cryptoHoldings.reduce((s, h) => s + h.valueBrl, 0)

  return {
    todayIso: new Date().toISOString(),
    cashBoxes,
    cryptoHoldings,
    categories: gf.categories.map((c) => c.name),
    totalCashBrl,
    totalCryptoBrl,
  }
}

const VOICE_HELP_HREF = '/news/gestao-financeira/microfone'

/** Registro por frase — digitar, falar ou interpretar com OpenAI. */
export function GfQuickRegister() {
  const gf = useGestaoFinanceira()
  const speech = useGfSpeechInput()
  const interpretRef = useRef<(phrase: string) => Promise<void>>(async () => {})
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<GfVoiceParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [interpreting, setInterpreting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [highlightMic, setHighlightMic] = useState(false)

  useEffect(() => {
    const onRequestMic = () => setHighlightMic(true)
    window.addEventListener(GF_REQUEST_MIC_EVENT, onRequestMic)
    return () => window.removeEventListener(GF_REQUEST_MIC_EVENT, onRequestMic)
  }, [])

  const localHint = text.trim() ? parseGfVoiceText(text.trim()) : null

  const handleInterpret = async (overrideText?: string) => {
    const phrase = (overrideText ?? text).trim()
    if (!phrase) return
    if (overrideText) setText(overrideText)
    setError(null)
    setParsed(null)
    setInterpreting(true)

    try {
      const ctx = buildContext(gf)
      const balanceLocal = tryLocalBalanceQuery(phrase, ctx)
      if (balanceLocal) {
        setParsed(balanceLocal)
        return
      }

      const local = parseGfVoiceText(phrase)
      if (local) {
        setParsed({ kind: 'transaction', entry: local, source: 'local' })
        return
      }

      const settings = loadGfOpenAiSettings()
      if (settings.enabled && settings.apiKey.trim()) {
        const { result, error: apiError } = await parseGfVoiceWithOpenAi(phrase, ctx)
        if (result) {
          setParsed(result)
          return
        }
        if (apiError) {
          setError(apiError)
        }
      }

      setError(
        settings.enabled && settings.apiKey.trim()
          ? 'Não entendi. Inclua valor e ação (ex.: gastei 50 no mercado) ou pergunte o saldo.'
          : 'Não entendi. Ative a OpenAI para frases complexas ou consultas como «quanto tenho no caixa».',
      )
    } finally {
      setInterpreting(false)
    }
  }

  interpretRef.current = handleInterpret

  const handleMic = () => {
    setHighlightMic(false)
    speech.clearError()
    void speech.toggle((transcript) => {
      setText(transcript)
      setParsed(null)
      setError(null)
      void interpretRef.current(transcript)
    })
  }

  const handleSave = async () => {
    if (!parsed || parsed.kind !== 'transaction') return
    setSaving(true)
    try {
      const ok = await saveGfParsedVoiceEntry(parsed.entry)
      if (ok) {
        setText('')
        setParsed(null)
        setError(null)
      }
    } finally {
      setSaving(false)
    }
  }

  const statusLine = speech.requestingPermission
    ? 'A pedir permissão do microfone…'
    : speech.transcribing
      ? 'Transcrevendo áudio…'
      : speech.listening && speech.mode === 'whisper'
        ? 'Gravando… toque no 🎤 para parar.'
        : null

  return (
    <div className="rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/35 to-teal-950/15 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/90 text-white">
          <PenLine className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground">Registrar em uma frase</h3>
            {speech.isMobile ? (
              <Link
                href={VOICE_HELP_HREF}
                className="inline-flex shrink-0 items-center gap-1 text-[11px] text-sky-400/90 hover:text-sky-300"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Ajuda
              </Link>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Toque no 🎤, fale e toque de novo para parar — ou digite a frase.
          </p>
        </div>
      </div>

      <GfPhraseInput
        value={text}
        onChange={(v) => {
          setText(v)
          setParsed(null)
          setError(null)
          speech.clearError()
        }}
        listening={speech.listening}
        requestingPermission={speech.requestingPermission}
        highlightMic={highlightMic}
        micSupported={speech.supported}
        onMicClick={handleMic}
      />

      {statusLine ? <p className="mt-2 text-xs text-muted-foreground">{statusLine}</p> : null}
      {speech.micError ? (
        <p className="mt-2 text-xs text-amber-200/90">
          {speech.micError}{' '}
          {speech.isMobile ? (
            <Link href={VOICE_HELP_HREF} className="text-sky-300 underline underline-offset-2">
              Ver ajuda
            </Link>
          ) : null}
        </p>
      ) : null}

      {localHint && !parsed ? (
        <p className="mt-2 text-xs text-muted-foreground">Pré-visualização local: {localHint.summary}</p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="flex-1 gap-2 border-violet-500/40"
          disabled={!text.trim() || interpreting}
          onClick={() => void handleInterpret()}
        >
          {interpreting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-violet-400" />}
          Interpretar
        </Button>
        {parsed?.kind === 'transaction' ? (
          <Button
            type="button"
            className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        ) : null}
      </div>

      {parsed?.kind === 'transaction' ? (
        <div className="mt-3">
          <GfParsedPreview parsed={parsed.entry} />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Fonte: {parsed.source === 'openai' ? 'OpenAI' : 'interpretação local (grátis)'}
          </p>
        </div>
      ) : null}

      {parsed?.kind === 'balance' ? (
        <div className="mt-3 rounded-lg border border-sky-500/25 bg-sky-950/20 p-3 text-sm">
          <p className="font-medium text-sky-200">Resposta</p>
          <p className="mt-1 whitespace-pre-line text-foreground">{parsed.answer}</p>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Fonte: {parsed.source === 'openai' ? 'OpenAI' : 'consulta local (grátis)'}
          </p>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-amber-200/90">{error}</p> : null}
    </div>
  )
}
