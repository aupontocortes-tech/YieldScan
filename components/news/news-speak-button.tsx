'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Volume2 } from 'lucide-react'
import { openYieldscanSqlite } from '@/lib/client-db/sqlite-core'
import { isNewsTtsHeard, pruneNewsTtsHeardIfStale } from '@/lib/news/news-tts-heard'
import {
  getNewsSpeechActiveId,
  getNewsSpeechActiveIdServer,
  isNewsSpeechSupported,
  playNewsSpeech,
  primeNewsSpeechVoices,
  subscribeNewsSpeech,
  toggleNewsSpeech,
} from '@/lib/speech/news-speech'
import { cn } from '@/lib/utils'

type Props = {
  speechId: string
  title: string
  description: string
  /** Sincronizado com SQLite (ex.: `useNewsTtsHeard` no cartão). */
  heard: boolean
  className?: string
  /** Primeira notícia breaking na lista: TTS automático se ainda não foi ouvida. */
  autoPlay?: boolean
}

export function NewsSpeakButton({ speechId, title, description, heard, className, autoPlay }: Props) {
  const [mounted, setMounted] = useState(false)
  const autoAttemptedRef = useRef(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    autoAttemptedRef.current = false
  }, [speechId])

  useEffect(() => {
    if (!autoPlay || !mounted || autoAttemptedRef.current || !isNewsSpeechSupported()) return
    void openYieldscanSqlite().then(() => {
      pruneNewsTtsHeardIfStale()
      if (isNewsTtsHeard(speechId)) return
      autoAttemptedRef.current = true
      playNewsSpeech(speechId, title, description, { skipIfHeard: true })
    })
  }, [autoPlay, speechId, title, description, mounted])

  const activeId = useSyncExternalStore(
    subscribeNewsSpeech,
    getNewsSpeechActiveId,
    getNewsSpeechActiveIdServer
  )
  const playing = activeId === speechId

  if (!mounted) {
    return (
      <span
        className={cn(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/30',
          className,
        )}
        aria-hidden
      >
        <Volume2 className="h-4 w-4 text-yellow-500/80" strokeWidth={2.25} />
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        primeNewsSpeechVoices()
        toggleNewsSpeech(speechId, title, description)
      }}
      className={cn(
        'pointer-events-auto z-20 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border',
        'transition-colors duration-200',
        'border-border/50 bg-muted/30 hover:border-yellow-500/40 hover:bg-yellow-500/10',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-yellow-500/60',
        heard &&
          !playing &&
          'border-emerald-500/35 bg-emerald-500/10 text-emerald-400 hover:text-emerald-300',
        (!heard || playing) && 'text-yellow-500 hover:text-yellow-400',
        playing && 'border-yellow-500/50 bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
        className
      )}
      title={
        playing ? 'Parar leitura' : heard ? 'Já ouvida' : 'Ouvir notícia'
      }
      aria-label={
        playing
          ? 'Parar leitura da notícia'
          : heard
            ? 'Já ouvida. Ouvir de novo'
            : 'Ouvir título e resumo da notícia'
      }
      aria-pressed={playing}
    >
      <Volume2
        className={cn('h-4 w-4 transition-colors duration-300 ease-out')}
        aria-hidden
        strokeWidth={2.25}
      />
    </button>
  )
}
