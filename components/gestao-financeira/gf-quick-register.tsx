'use client'

import { useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GfParsedPreview } from '@/components/gestao-financeira/gf-parsed-preview'
import { GfPhraseInput } from '@/components/gestao-financeira/gf-phrase-input'
import type { GfTabValue } from '@/components/gestao-financeira/gf-nav-tabs'
import { useGestaoFinanceira } from '@/hooks/use-gestao-financeira'
import { useGfSpeechInput, requestMicStreamSync } from '@/hooks/use-gf-speech-input'
import { interpretGfPhrase } from '@/lib/gestao-financeira/parse-phrase-with-openai'
import { buildGfPhraseContext } from '@/lib/gestao-financeira/phrase-context'
import type { GfPhraseRouteContext } from '@/lib/gestao-financeira/phrase-router'
import { saveGfParsedVoiceEntry } from '@/lib/gestao-financeira/save-parsed-voice'
import type { GfPhraseParseResult } from '@/lib/gestao-financeira/types'
import { primeGfSpeechVoices, toggleGfSpeech } from '@/lib/speech/gf-speech'
import { CalendarCheck, Loader2, Mic, Sparkles } from 'lucide-react'

const PLACEHOLDER = 'Fale ou digite…'
const QUICK_ANSWER_SPEECH_ID = 'gf-quick-answer'

function buildContext(gf: ReturnType<typeof useGestaoFinanceira>): GfPhraseRouteContext {
  return buildGfPhraseContext(gf)
}

function tabForResult(result: GfPhraseParseResult): GfTabValue | null {
  if (result.kind === 'todos' || result.kind === 'todo_action' || result.kind === 'todo_query') return 'afazeres'
  if (result.kind === 'transaction') return 'movimentos'
  if (result.kind === 'debt') return 'dividas'
  if (result.kind === 'report') return 'relatorios'
  return null
}

type Props = {
  gf: ReturnType<typeof useGestaoFinanceira>
  onTabChange?: (tab: GfTabValue) => void
}

/** Registro inteligente — a frase é encaminhada para o destino certo (qualquer aba). */
export function GfQuickRegister({ gf, onTabChange }: Props) {
  const speech = useGfSpeechInput({ preferRealtime: true })
  const interpretRef = useRef<(phrase: string) => Promise<void>>(async () => {})
  const phraseInputRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<GfPhraseParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [interpreting, setInterpreting] = useState(false)
  const [saving, setSaving] = useState(false)

  const clearParsed = () => {
    setParsed(null)
    setError(null)
  }

  const handleInterpret = async (overrideText?: string) => {
    const phrase = (overrideText ?? text).trim()
    if (!phrase) return
    if (overrideText) setText(overrideText)
    clearParsed()
    setInterpreting(true)

    try {
      const { result, error: err } = await interpretGfPhrase(phrase, buildContext(gf))
      if (result) {
        setParsed(result)
        const tab = tabForResult(result)
        if (tab && result.kind !== 'balance') {
          onTabChange?.(tab)
        }
        if (result.kind === 'balance' || result.kind === 'report' || result.kind === 'todo_query') {
          primeGfSpeechVoices()
          toggleGfSpeech(QUICK_ANSWER_SPEECH_ID, result.answer)
        }
      } else if (err) {
        setError(err)
      }
    } finally {
      setInterpreting(false)
    }
  }

  interpretRef.current = handleInterpret

  const selectPhraseText = (phrase: string) => {
    requestAnimationFrame(() => {
      const el = phraseInputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(0, phrase.length)
    })
  }

  const handleMic = () => {
    speech.clearError()
    const onInterim = (transcript: string) => {
      setText(transcript)
    }
    const onFinal = (transcript: string) => {
      const trimmed = transcript.trim()
      if (!trimmed) return
      setText(trimmed)
      clearParsed()
      selectPhraseText(trimmed)
      void interpretRef.current(trimmed)
    }
    speech.toggle(onFinal, requestMicStreamSync(), onInterim)
  }

  const handleSave = async () => {
    if (!parsed) return
    setSaving(true)
    try {
      if (parsed.kind === 'todos' && parsed.items.length) {
        await gf.addTodos(
          parsed.items.map((p) => ({
            title: p.title,
            notes: p.notes,
            dueDate: p.dueDate,
            dueTime: p.dueTime,
            priority: p.priority,
          })),
        )
        onTabChange?.('afazeres')
        setText('')
        clearParsed()
        return
      }

      if (parsed.kind === 'todo_action') {
        const ok = await gf.applyTodoAction(parsed.action)
        if (!ok) {
          setError(`Não encontrei o afazer «${parsed.action.titleMatch}». Verifique o título na lista.`)
          return
        }
        onTabChange?.('afazeres')
        setText('')
        clearParsed()
        return
      }

      if (parsed.kind === 'transaction') {
        const ok = await saveGfParsedVoiceEntry(parsed.entry)
        if (ok) {
          onTabChange?.('movimentos')
          setText('')
          clearParsed()
        }
        return
      }

      if (parsed.kind === 'debt') {
        await gf.addDebt({
          name: parsed.entry.name,
          totalAmount: parsed.entry.totalAmount,
          paidAmount: 0,
          installments: parsed.entry.installments,
          paidInstallments: 0,
          dueDate: parsed.entry.dueDate,
        })
        onTabChange?.('dividas')
        setText('')
        clearParsed()
      }
    } finally {
      setSaving(false)
    }
  }

  const canSave =
    parsed?.kind === 'todos' ||
    parsed?.kind === 'todo_action' ||
    parsed?.kind === 'transaction' ||
    parsed?.kind === 'debt'

  return (
    <div className="rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/35 to-teal-950/15 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/90 text-white">
          <Mic className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">Falar ou escrever — a IA direciona</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Caixa, afazeres, dívidas, relatórios ou movimentos — em qualquer aba.
          </p>
        </div>
      </div>

      <GfPhraseInput
        inputRef={phraseInputRef}
        value={text}
        onChange={(v) => {
          setText(v)
          clearParsed()
          speech.clearError()
        }}
        placeholder={PLACEHOLDER}
        listeningPlaceholder=""
        listening={speech.listening || speech.transcribing}
        transcribing={speech.transcribing}
        requestingPermission={speech.requestingPermission}
        micSupported={speech.supported}
        onMicClick={handleMic}
        lightSurface
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
          <Badge variant="outline" className="mb-2 border-emerald-500/40 text-emerald-200">
            → Movimento
          </Badge>
          <GfParsedPreview parsed={parsed.entry} />
        </div>
      ) : null}

      {(parsed?.kind === 'balance' || parsed?.kind === 'report' || parsed?.kind === 'todo_query') && (
        <div className="mt-3 rounded-lg border border-sky-500/25 bg-sky-950/20 p-3 text-sm">
          <p className="font-medium text-sky-200">
            {parsed.kind === 'report' ? 'Relatório' : parsed.kind === 'todo_query' ? 'Afazeres' : 'Resposta'}
          </p>
          <p className="mt-1 whitespace-pre-line text-foreground">{parsed.answer}</p>
        </div>
      )}

      {parsed?.kind === 'todos' && parsed.items.length > 0 ? (
        <div className="mt-3 rounded-lg border border-violet-500/25 bg-violet-950/20 p-3 text-sm">
          <p className="mb-2 font-medium text-violet-200">→ Afazeres a salvar</p>
          <ul className="space-y-2">
            {parsed.items.map((item, i) => (
              <li key={i} className="rounded-md border border-border/40 bg-background/40 px-3 py-2">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {parsed?.kind === 'todo_action' ? (
        <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-950/20 p-3 text-sm">
          <p className="font-medium text-amber-200">→ Atualizar afazer</p>
          <p className="mt-1 text-foreground">{parsed.action.summary}</p>
        </div>
      ) : null}

      {parsed?.kind === 'debt' ? (
        <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-950/20 p-3 text-sm">
          <p className="font-medium text-rose-200">→ Nova dívida</p>
          <p className="mt-1 text-foreground">{parsed.entry.summary}</p>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-amber-200/90">{error}</p> : null}
    </div>
  )
}
