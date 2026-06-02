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
        className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center', className)}
        aria-hidden
      />
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
        'pointer-events-auto z-20 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
        'transition-colors transition-opacity duration-300 ease-out',
        'bg-black/25 backdrop-blur-[2px] hover:bg-black/40',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-yellow-500/60',
        heard &&
          !playing &&
          'text-emerald-400 opacity-90 shadow-[0_0_10px_rgba(52,211,153,0.25)] hover:text-emerald-300',
        (!heard || playing) && 'text-white opacity-70 hover:opacity-100',
        playing && 'ring-1 ring-white/40 opacity-100 shadow-none',
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
