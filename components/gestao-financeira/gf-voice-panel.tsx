'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { useGestaoFinanceira } from '@/hooks/use-gestao-financeira'
import { buildGfSimpleNarrative } from '@/lib/gestao-financeira/simple-narrative'
import {
  getGfSpeechActiveId,
  getGfSpeechActiveIdServer,
  isGfSpeechSupported,
  primeGfSpeechVoices,
  subscribeGfSpeech,
  toggleGfSpeech,
} from '@/lib/speech/gf-speech'
import { cn } from '@/lib/utils'
import { ChevronDown, Sparkles, Volume2 } from 'lucide-react'

const NARRATIVE_SPEECH_ID = 'gf-narrative-summary'

type Props = {
  gf: ReturnType<typeof useGestaoFinanceira>
  insights: string[]
}

export function GfVoicePanel({ gf, insights }: Props) {
  const [open, setOpen] = useState(false)

  const narrative = useMemo(() => {
    if (!gf.stats) return null
    return buildGfSimpleNarrative({
      stats: gf.stats,
      insights,
      todos: gf.todos,
      transactions: gf.transactions,
      categories: gf.categories,
    })
  }, [gf.stats, insights, gf.todos, gf.transactions, gf.categories])

  const narrativePlaying = useSyncExternalStore(
    subscribeGfSpeech,
    () => getGfSpeechActiveId() === NARRATIVE_SPEECH_ID,
    () => false,
  )

  const handleSpeakNarrative = () => {
    if (!narrative?.fullText) return
    primeGfSpeechVoices()
    toggleGfSpeech(NARRATIVE_SPEECH_ID, narrative.fullText)
  }

  if (!narrative) return null

  const toneBorder =
    narrative.savingsTone === 'good'
      ? 'border-emerald-500/25'
      : narrative.savingsTone === 'warn'
        ? 'border-amber-500/30'
        : 'border-emerald-500/20'

  return (
    <div className={cn('rounded-2xl border bg-emerald-950/15', toneBorder)}>
      <div className="flex items-center gap-2 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={open}
        >
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-300" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-300">IA Financeira</p>
            <p className="text-xs text-muted-foreground">
              {open ? 'Toque para fechar o resumo' : 'Toque para ver o resumo simples'}
            </p>
          </div>
          <ChevronDown
            className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        </button>
        {open && isGfSpeechSupported() ? (
          <button
            type="button"
            onClick={handleSpeakNarrative}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors',
              narrativePlaying
                ? 'border-yellow-500/50 bg-yellow-500/15 text-yellow-400'
                : 'border-border/50 bg-muted/30 text-yellow-500 hover:bg-yellow-500/10',
            )}
            title={narrativePlaying ? 'Parar leitura' : 'Ouvir resumo'}
            aria-label={narrativePlaying ? 'Parar leitura' : 'Ouvir resumo'}
            aria-pressed={narrativePlaying}
          >
            <Volume2 className="h-4 w-4" strokeWidth={2.25} />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="border-t border-border/30 px-4 pb-4">
          <div className="mt-3 rounded-xl border border-border/40 bg-background/30 px-4 py-3">
            <p
              className={cn(
                'text-sm font-medium',
                narrative.savingsTone === 'good' && 'text-emerald-300',
                narrative.savingsTone === 'warn' && 'text-amber-300',
                narrative.savingsTone === 'neutral' && 'text-foreground',
              )}
            >
              {narrative.headline}
            </p>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
              {narrative.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>

          {insights.length > 1 ? (
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {insights.slice(1).map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          ) : null}

          <p className="mt-3 text-[11px] text-muted-foreground/80">
            Resumo local — não usa API. Para perguntar por voz, use a barra «Falar ou escrever» acima.
          </p>
        </div>
      ) : null}
    </div>
  )
}
