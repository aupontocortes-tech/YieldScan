'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  getNewsSpeechActiveId,
  getNewsSpeechActiveIdServer,
  isNewsSpeechSupported,
  subscribeNewsSpeech,
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
  useEffect(() => setMounted(true), [])

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
        'text-[15px] leading-none text-white opacity-70 transition-opacity hover:opacity-100',
        'bg-black/25 backdrop-blur-[2px] hover:bg-black/40',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-yellow-500/60',
        playing && 'opacity-100 ring-1 ring-white/40',
        className
      )}
      title={playing ? 'Parar leitura' : 'Ouvir notícia'}
      aria-label={playing ? 'Parar leitura da notícia' : 'Ouvir título e resumo da notícia'}
      aria-pressed={playing}
    >
      <span aria-hidden>🔊</span>
    </button>
  )
}
