'use client'

import { useEffect, useMemo, useState } from 'react'
import { computeOptimizedBtcSignals } from '@/lib/btc/signal-system'
import { getHigherTimeframeId, type TrendRadarAnalysis } from '@/lib/btc/trend-radar'
import { TIMEFRAME_PRESETS, type OhlcvBar } from '@/lib/btc/types'

/** Calcula o Radar fora do render síncrono para não bloquear toques na barra de ferramentas. */
export function useTrendRadarAnalysis(
  enabled: boolean,
  bars: OhlcvBar[],
  htfBars: OhlcvBar[],
  timeframe: { id: string; label: string },
): { analysis: TrendRadarAnalysis | null; computing: boolean } {
  const [analysis, setAnalysis] = useState<TrendRadarAnalysis | null>(null)
  const [computing, setComputing] = useState(false)

  const inputKey = useMemo(() => {
    if (!enabled || bars.length < 55) return null
    const last = bars[bars.length - 1]?.time ?? 0
    const htfLast = htfBars[htfBars.length - 1]?.time ?? 0
    return `${timeframe.id}:${bars.length}:${last}:${htfBars.length}:${htfLast}`
  }, [enabled, bars, htfBars, timeframe.id])

  useEffect(() => {
    if (!inputKey) {
      setAnalysis(null)
      setComputing(false)
      return
    }

    let cancelled = false
    setComputing(true)

    const run = () => {
      if (cancelled) return
      try {
        const htfId = getHigherTimeframeId(timeframe.id)
        const htfLabel = TIMEFRAME_PRESETS.find((t) => t.id === htfId)?.label ?? htfId
        const result = computeOptimizedBtcSignals(
          bars,
          htfBars.length >= 25 ? htfBars : undefined,
          { chartLabel: timeframe.label, htfLabel, optimize: bars.length >= 80 },
        )
        if (!cancelled) {
          setAnalysis(result)
          setComputing(false)
        }
      } catch {
        if (!cancelled) {
          setAnalysis(null)
          setComputing(false)
        }
      }
    }

    const idle =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? window.requestIdleCallback(run, { timeout: 1200 })
        : window.setTimeout(run, 32)

    return () => {
      cancelled = true
      if (typeof idle === 'number') {
        window.clearTimeout(idle)
      } else if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idle as number)
      }
    }
  }, [inputKey, bars, htfBars, timeframe.id, timeframe.label])

  return { analysis, computing }
}
