'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isYieldscanSqliteOpen, openYieldscanSqlite } from '@/lib/client-db/sqlite-core'
import { isNewsSeen, markNewsSeen, pruneNewsSeenIfStale } from '@/lib/news/news-seen'

const IO_THRESHOLD = 0.6

/** Hidratação SQLite + marcação única (viewport ≥60% ou interação). */
export function useNewsSeen(speechId: string) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const triggeredRef = useRef(false)

  const [seen, setSeen] = useState(() => {
    if (typeof window === 'undefined') return false
    if (!isYieldscanSqliteOpen()) return false
    return isNewsSeen(speechId)
  })

  useEffect(() => {
    triggeredRef.current = false
  }, [speechId])

  useEffect(() => {
    if (typeof window !== 'undefined' && isYieldscanSqliteOpen()) {
      setSeen(isNewsSeen(speechId))
    } else {
      setSeen(false)
    }
    let cancel = false
    void openYieldscanSqlite().then(() => {
      if (cancel) return
      pruneNewsSeenIfStale()
      setSeen(isNewsSeen(speechId))
    })
    return () => {
      cancel = true
    }
  }, [speechId])

  const markSeenOnce = useCallback(() => {
    if (triggeredRef.current) return
    triggeredRef.current = true
    markNewsSeen(speechId)
    setSeen(true)
  }, [speechId])

  useEffect(() => {
    const el = cardRef.current
    if (typeof IntersectionObserver === 'undefined' || !el) return
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        if (!e?.isIntersecting || e.intersectionRatio < IO_THRESHOLD) return
        markSeenOnce()
      },
      { threshold: [0, 0.25, 0.5, IO_THRESHOLD, 0.75, 1] }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [speechId, markSeenOnce])

  return { seen, markSeenOnce, cardRef }
}
