'use client'

import { useEffect, useState } from 'react'
import { isYieldscanSqliteOpen, openYieldscanSqlite } from '@/lib/client-db/sqlite-core'
import { isNewsTtsHeard, markNewsTtsHeard, pruneNewsTtsHeardIfStale } from '@/lib/news/news-tts-heard'
import { subscribeNewsSpeechHeard } from '@/lib/speech/news-speech'

/** Estado hidratado do SQLite + atualização quando o TTS marca como ouvida. */
export function useNewsTtsHeard(speechId: string): boolean {
  const [heard, setHeard] = useState(() => {
    if (typeof window === 'undefined') return false
    if (!isYieldscanSqliteOpen()) return false
    return isNewsTtsHeard(speechId)
  })

  useEffect(() => {
    if (typeof window !== 'undefined' && isYieldscanSqliteOpen()) {
      setHeard(isNewsTtsHeard(speechId))
    } else {
      setHeard(false)
    }
    let cancel = false
    void openYieldscanSqlite().then(() => {
      if (cancel) return
      pruneNewsTtsHeardIfStale()
      setHeard(isNewsTtsHeard(speechId))
    })
    return () => {
      cancel = true
    }
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
