'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Volume2 } from 'lucide-react'
import { openYieldscanSqlite } from '@/lib/client-db/sqlite-core'
import { isNewsTtsHeard, markNewsTtsHeard } from '@/lib/news/news-tts-heard'
import {
  getNewsSpeechActiveId,
  getNewsSpeechActiveIdServer,
  isNewsSpeechSupported,
  subscribeNewsSpeech,
  subscribeNewsSpeechHeard,
  toggleNewsSpeech,
} from '@/lib/speech/news-speech'
import { cn } from '@/lib/utils'

type Props = {
  speechId: string
  title: string
  description: string
  className?: string
}

export function NewsSpeakButton({ speechId, title, description, className }: Props) {
  const [mounted, setMounted] = useState(false)
  const [heard, setHeard] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    void openYieldscanSqlite().then(() => {
      if (isNewsTtsHeard(speechId)) setHeard(true)
    })
  }, [speechId])

  useEffect(() => {
    return subscribeNewsSpeechHeard((id) => {
      if (id !== speechId) return
      markNewsTtsHeard(speechId)
      setHeard(true)
    })
  }, [speechId])

  const activeId = useSyncExternalStore(
    subscribeNewsSpeech,
    getNewsSpeechActiveId,
    getNewsSpeechActiveIdServer
  )
  const playing = activeId === speechId

  if (!mounted || !isNewsSpeechSupported()) return null

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleNewsSpeech(speechId, title, description)
      }}
      className={cn(
        'pointer-events-auto z-20 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
        'transition-colors transition-opacity',
        'bg-black/25 backdrop-blur-[2px] hover:bg-black/40',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-yellow-500/60',
        heard && !playing && 'text-emerald-400 opacity-100 hover:text-emerald-300',
        (!heard || playing) && 'text-white opacity-70 hover:opacity-100',
        playing && 'ring-1 ring-white/40 opacity-100',
        className
      )}
      title={
        playing
          ? 'Parar leitura'
          : heard
            ? 'Já ouviu esta notícia — ouvir de novo'
            : 'Ouvir notícia'
      }
      aria-label={
        playing
          ? 'Parar leitura da notícia'
          : heard
            ? 'Notícia já ouvida até ao fim. Ouvir de novo'
            : 'Ouvir título e resumo da notícia'
      }
      aria-pressed={playing}
    >
      <Volume2 className="h-4 w-4" aria-hidden strokeWidth={2.25} />
    </button>
  )
}
