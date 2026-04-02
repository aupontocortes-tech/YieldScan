/**
 * Technical indicators — pure functions, reusable.
 */

/** Simple moving average; null until enough samples. */
export function sma(values: number[], period: number): (number | null)[] {
  const n = values.length
  const out: (number | null)[] = Array(n).fill(null)
  if (period < 1 || n < period) return out
  for (let i = period - 1; i < n; i++) {
    let s = 0
    for (let j = 0; j < period; j++) s += values[i - j]
    out[i] = s / period
  }
  return out
}

/** Exponential moving average. */
export function ema(values: number[], period: number): (number | null)[] {
  const n = values.length
  const out: (number | null)[] = Array(n).fill(null)
  if (period < 1 || n < period) return out
  const k = 2 / (period + 1)
  let prev = 0
  for (let j = 0; j < period; j++) prev += values[j]
  prev /= period
  out[period - 1] = prev
  for (let i = period; i < n; i++) {
    prev = values[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

export function rsi(closes: number[], period = 14): (number | null)[] {
  const n = closes.length
  const out: (number | null)[] = Array(n).fill(null)
  if (period < 1 || n <= period) return out

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1]
    if (ch >= 0) avgGain += ch
    else avgLoss -= ch
  }
  avgGain /= period
  avgLoss /= period

  const rs = () => (avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  out[period] = rs()

  for (let i = period + 1; i < n; i++) {
    const ch = closes[i] - closes[i - 1]
    const g = ch > 0 ? ch : 0
    const l = ch < 0 ? -ch : 0
    avgGain = (avgGain * (period - 1) + g) / period
    avgLoss = (avgLoss * (period - 1) + l) / period
    out[i] = rs()
  }
  return out
}

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): { line: (number | null)[]; signal: (number | null)[]; hist: (number | null)[] } {
  const n = closes.length
  const ef = ema(closes, fast)
  const es = ema(closes, slow)
  const line: (number | null)[] = Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    if (ef[i] != null && es[i] != null) line[i] = ef[i]! - es[i]!
  }

  const macdVals: number[] = []
  const macdIdx: number[] = []
  for (let i = 0; i < n; i++) {
    if (line[i] != null) {
      macdVals.push(line[i]!)
      macdIdx.push(i)
    }
  }
  const sigSeg = ema(macdVals, signalPeriod)
  const signal: (number | null)[] = Array(n).fill(null)
  for (let j = 0; j < macdIdx.length; j++) {
    if (sigSeg[j] != null) signal[macdIdx[j]] = sigSeg[j]
  }

  const hist: (number | null)[] = Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    if (line[i] != null && signal[i] != null) hist[i] = line[i]! - signal[i]!
  }

  return { line, signal, hist }
}

/** Stochastic %K (smoothed) and %D. */
export function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod: number,
  dPeriod: number,
  smooth: number
): { k: (number | null)[]; d: (number | null)[] } {
  const n = closes.length
  const rawK: (number | null)[] = Array(n).fill(null)
  for (let i = kPeriod - 1; i < n; i++) {
    let hh = -Infinity
    let ll = Infinity
    for (let j = 0; j < kPeriod; j++) {
      hh = Math.max(hh, highs[i - j])
      ll = Math.min(ll, lows[i - j])
    }
    const denom = hh - ll
    rawK[i] = denom === 0 ? 50 : ((closes[i] - ll) / denom) * 100
  }

  const sp = Math.max(1, Math.floor(smooth))
  const k: (number | null)[] = Array(n).fill(null)
  const kStart = kPeriod - 1 + sp - 1
  for (let i = kStart; i < n; i++) {
    let sum = 0
    let ok = true
    for (let j = 0; j < sp; j++) {
      const v = rawK[i - j]
      if (v == null) {
        ok = false
        break
      }
      sum += v
    }
    if (ok) k[i] = sum / sp
  }

  const d: (number | null)[] = Array(n).fill(null)
  const dStart = kStart + dPeriod - 1
  for (let i = dStart; i < n; i++) {
    let sum = 0
    let ok = true
    for (let j = 0; j < dPeriod; j++) {
      const v = k[i - j]
      if (v == null) {
        ok = false
        break
      }
      sum += v
    }
    if (ok) d[i] = sum / dPeriod
  }

  return { k, d }
}

export function movingAverage(
  closes: number[],
  period: number,
  type: 'SMA' | 'EMA'
): (number | null)[] {
  return type === 'SMA' ? sma(closes, period) : ema(closes, period)
}
