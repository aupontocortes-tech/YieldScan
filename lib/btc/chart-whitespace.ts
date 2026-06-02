import type { Time } from 'lightweight-charts'
import type { OhlcvBar } from '@/lib/btc/types'
import { inferBarTimeStep } from '@/lib/drawing-system/core/time-scale-extrapolation'

/** Barras vazias à frente da última vela — preenchem o vão do right offset para desenhos/indicadores. */
export function buildFutureWhitespace(bars: OhlcvBar[], count = 120): { time: Time }[] {
  if (bars.length < 1 || count < 1) return []
  const step = inferBarTimeStep(bars)
  const last = bars[bars.length - 1].time
  const out: { time: Time }[] = []
  for (let i = 1; i <= count; i++) {
    out.push({ time: (last + step * i) as Time })
  }
  return out
}

/** Quantas barras vazias adicionar conforme o zoom/scroll (margem além do range visível). */
export function whitespaceCountForLogicalRange(
  barsLength: number,
  logicalTo: number,
  min = 80,
  margin = 24,
): number {
  const need = Math.ceil(Math.max(0, logicalTo - (barsLength - 1)) + margin)
  return Math.max(min, need)
}
