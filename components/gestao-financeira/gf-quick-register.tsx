'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { GfParsedPreview } from '@/components/gestao-financeira/gf-parsed-preview'
import { GfPhraseInput } from '@/components/gestao-financeira/gf-phrase-input'
import { useGestaoFinanceira } from '@/hooks/use-gestao-financeira'
import { useGfSpeechInput, requestMicStreamSync } from '@/hooks/use-gf-speech-input'
import { loadGfOpenAiSettings } from '@/lib/gestao-financeira/openai-config'
import {
  parseGfVoiceWithOpenAi,
  tryLocalBalanceQuery,
  type GfParseVoiceContext,
} from '@/lib/gestao-financeira/parse-with-openai'
import { parseGfTodosWithOpenAi } from '@/lib/gestao-financeira/parse-todos-with-openai'
import { parseGfTodosText } from '@/lib/gestao-financeira/todos-parser'
import { saveGfParsedVoiceEntry } from '@/lib/gestao-financeira/save-parsed-voice'
import { parseGfVoiceText } from '@/lib/gestao-financeira/voice-parser'
import type { GfParsedTodoEntry, GfVoiceParseResult } from '@/lib/gestao-financeira/types'
import { CalendarCheck, Loader2, PenLine, Sparkles } from 'lucide-react'

export type GfQuickRegisterMode = 'finance' | 'afazeres'

const PLACEHOLDERS: Record<GfQuickRegisterMode, string> = {
  finance: 'Ex.: Gastei 80 no mercado · Adicionei 500 · Quanto tenho no caixa?',
  afazeres: 'Ex.: Amanhã dentista às 14h · Sexta pagar luz · Quinta reunião às 10h',
}

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

type Props = {
  gf: ReturnType<typeof useGestaoFinanceira>
  mode: GfQuickRegisterMode
}

/** Registro por frase — finanças ou afazeres conforme a aba activa. */
export function GfQuickRegister({ gf, mode }: Props) {
  const speech = useGfSpeechInput()
  const interpretRef = useRef<(phrase: string) => Promise<void>>(async () => {})
  const [text, setText] = useState('')
  const [parsedFinance, setParsedFinance] = useState<GfVoiceParseResult | null>(null)
  const [parsedTodos, setParsedTodos] = useState<GfParsedTodoEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [interpreting, setInterpreting] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setText('')
    setParsedFinance(null)
    setParsedTodos(null)
    setError(null)
    speech.clearError()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const clearParsed = () => {
    setParsedFinance(null)
    setParsedTodos(null)
    setError(null)
  }

  const interpretFinance = async (phrase: string) => {
    const ctx = buildContext(gf)
    const balanceLocal = tryLocalBalanceQuery(phrase, ctx)
    if (balanceLocal) {
      setParsedFinance(balanceLocal)
      return
    }

    const local = parseGfVoiceText(phrase)
    if (local) {
      setParsedFinance({ kind: 'transaction', entry: local, source: 'local' })
      return
    }

    const settings = loadGfOpenAiSettings()
    if (settings.enabled && settings.apiKey.trim()) {
      const { result, error: apiError } = await parseGfVoiceWithOpenAi(phrase, ctx)
      if (result) {
        setParsedFinance(result)
        return
      }
      if (apiError) setError(apiError)
    }

    setError(
      settings.enabled && settings.apiKey.trim()
        ? 'Não entendi. Inclua valor e ação (ex.: gastei 50 no mercado) ou pergunte o saldo.'
        : 'Não entendi. Ative a OpenAI para frases complexas ou consultas como «quanto tenho no caixa».',
    )
  }

  const interpretAfazeres = async (phrase: string) => {
    const ctx = {
      todayIso: new Date().toISOString(),
      existingTodos: gf.todos.map((t) => ({ title: t.title, dueDate: t.dueDate })),
    }

    const settings = loadGfOpenAiSettings()
    if (settings.enabled && settings.apiKey.trim()) {
      const { result, error: apiError } = await parseGfTodosWithOpenAi(phrase, ctx)
      if (result?.items.length) {
        setParsedTodos(result.items)
        return
      }
      if (apiError) setError(apiError)
    }

    const local = parseGfTodosText(phrase, ctx.todayIso)
    if (local.length) {
      setParsedTodos(local)
      return
    }

    setError(
      settings.enabled && settings.apiKey.trim()
        ? 'Não entendi. Ex.: «Amanhã dentista às 14h» ou «Sexta pagar luz e quinta reunião».'
        : 'Ative a OpenAI em Uso da API para organizar lembretes por voz.',
    )
  }

  const handleInterpret = async (overrideText?: string) => {
    const phrase = (overrideText ?? text).trim()
    if (!phrase) return
    if (overrideText) setText(overrideText)
    clearParsed()
    setInterpreting(true)

    try {
      if (mode === 'afazeres') await interpretAfazeres(phrase)
      else await interpretFinance(phrase)
    } finally {
      setInterpreting(false)
    }
  }

  interpretRef.current = handleInterpret

  const handleMic = () => {
    speech.clearError()
    const onFinal = (transcript: string) => {
      setText(transcript)
      clearParsed()
      void interpretRef.current(transcript)
    }
    speech.toggle(onFinal, requestMicStreamSync())
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (mode === 'afazeres' && parsedTodos?.length) {
        await gf.addTodos(
          parsedTodos.map((p) => ({
            title: p.title,
            notes: p.notes,
            dueDate: p.dueDate,
            dueTime: p.dueTime,
            priority: p.priority,
          })),
        )
        setText('')
        clearParsed()
        return
      }

      if (mode === 'finance' && parsedFinance?.kind === 'transaction') {
        const ok = await saveGfParsedVoiceEntry(parsedFinance.entry)
        if (ok) {
          setText('')
          clearParsed()
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const canSave =
    mode === 'afazeres'
      ? (parsedTodos?.length ?? 0) > 0
      : parsedFinance?.kind === 'transaction'

  const title = mode === 'afazeres' ? 'Registrar afazeres em uma frase' : 'Registrar em uma frase'
  const Icon = mode === 'afazeres' ? CalendarCheck : PenLine
  const iconBg = mode === 'afazeres' ? 'bg-violet-600/90' : 'bg-emerald-600/90'
  const borderClass =
    mode === 'afazeres'
      ? 'border-violet-500/35 bg-gradient-to-br from-violet-950/30 to-indigo-950/15'
      : 'border-emerald-500/35 bg-gradient-to-br from-emerald-950/35 to-teal-950/15'

  return (
    <div className={`rounded-2xl border p-4 ${borderClass}`}>
      <div className="mb-3 flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">{title}</h3>
          {mode === 'afazeres' ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Fale ou digite — a OpenAI organiza lembretes por data na lista abaixo.
            </p>
          ) : null}
        </div>
      </div>

      <GfPhraseInput
        value={text}
        onChange={(v) => {
          setText(v)
          clearParsed()
          speech.clearError()
        }}
        placeholder={PLACEHOLDERS[mode]}
        listening={speech.listening}
        requestingPermission={speech.requestingPermission}
        micSupported={speech.supported}
        onMicClick={handleMic}
        lightSurface={mode === 'afazeres'}
      />

      {speech.micError ? <p className="mt-2 text-xs text-amber-200/90">{speech.micError}</p> : null}

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
        {canSave ? (
          <Button
            type="button"
            className={`flex-1 gap-2 ${mode === 'afazeres' ? 'bg-violet-600 hover:bg-violet-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        ) : null}
      </div>

      {mode === 'finance' && parsedFinance?.kind === 'transaction' ? (
        <div className="mt-3">
          <GfParsedPreview parsed={parsedFinance.entry} />
        </div>
      ) : null}

      {mode === 'finance' && parsedFinance?.kind === 'balance' ? (
        <div className="mt-3 rounded-lg border border-sky-500/25 bg-sky-950/20 p-3 text-sm">
          <p className="font-medium text-sky-200">Resposta</p>
          <p className="mt-1 whitespace-pre-line text-foreground">{parsedFinance.answer}</p>
        </div>
      ) : null}

      {mode === 'afazeres' && parsedTodos && parsedTodos.length > 0 ? (
        <div className="mt-3 rounded-lg border border-violet-500/25 bg-violet-950/20 p-3 text-sm">
          <p className="font-medium text-violet-200">Lembretes a salvar</p>
          <ul className="mt-2 space-y-2">
            {parsedTodos.map((item, i) => (
              <li key={i} className="rounded-md border border-border/40 bg-background/40 px-3 py-2">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-amber-200/90">{error}</p> : null}
    </div>
  )
}
