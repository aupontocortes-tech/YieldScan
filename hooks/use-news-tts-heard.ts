'use client'

import { useEffect, useState } from 'react'
import { openYieldscanSqlite } from '@/lib/client-db/sqlite-core'
import { isNewsTtsHeard, markNewsTtsHeard, pruneNewsTtsHeardIfStale } from '@/lib/news/news-tts-heard'
import { subscribeNewsSpeechHeard } from '@/lib/speech/news-speech'

/** Estado hidratado do SQLite + atualização quando o TTS marca como ouvida. */
export function useNewsTtsHeard(speechId: string): boolean {
  const [heard, setHeard] = useState(false)

  useEffect(() => {
    void openYieldscanSqlite().then(() => {
      pruneNewsTtsHeardIfStale()
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

  return heard
}
