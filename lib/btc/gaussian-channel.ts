import type { OhlcvBar } from '@/lib/btc/types'

/**
 * Canal Gaussiano no formato do TradingView (Gaussian Channel [DW] / Ehlers).
 * Defaults do script: 4 polos, período 144, multiplicador 1.414, reduced lag desligado.
 */
export const GAUSSIAN_CHANNEL_POLES = 4
export const GAUSSIAN_CHANNEL_PERIOD = 144
export const GAUSSIAN_CHANNEL_MULT = 1.414
export const GAUSSIAN_COLOR_UP = '#0aff68'
export const GAUSSIAN_COLOR_DOWN = '#ff1100'

export type GaussianChannelSeries = {
  mid: (number | null)[]
  upper: (number | null)[]
  lower: (number | null)[]
  /** true quando o filtro sobe face à vela anterior (verde no TradingView). */
  rising: boolean[]
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let c = 1
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1)
  return Math.round(c)
}

/** Filtro recursivo de N polos — mesma recorrência do f_filt9x do script DW. */
function gaussianFilter(src: number[], period: number, poles: number): number[] {
  const safePeriod = Math.max(2, period)
  const safePoles = Math.min(9, Math.max(1, Math.round(poles)))
  const beta =
    (1 - Math.cos((2 * Math.PI) / safePeriod)) / (Math.pow(1.414, 2 / safePoles) - 1)
  const alpha = -beta + Math.sqrt(beta * beta + 2 * beta)
  const decay = 1 - alpha
  const lead = Math.pow(alpha, safePoles)
  const coeffs = new Array<number>(safePoles + 1).fill(0)
  for (let k = 1; k <= safePoles; k++) {
    const sign = k % 2 === 0 ? -1 : 1
    coeffs[k] = sign * binomial(safePoles, k) * Math.pow(decay, k)
  }

  const out = new Array<number>(src.length)
  const hist: number[] = []
  for (let i = 0; i < src.length; i++) {
    const sample = Number.isFinite(src[i]) ? src[i]! : 0
    let value = lead * sample
    const lags = Math.min(safePoles, hist.length)
    for (let k = 1; k <= lags; k++) value += coeffs[k]! * hist[k - 1]!
    out[i] = value
    hist.unshift(value)
    if (hist.length > safePoles) hist.length = safePoles
  }
  return out
}

function trueRange(bars: OhlcvBar[]): number[] {
  return bars.map((bar, i) => {
    const range = bar.high - bar.low
    if (i === 0) return Math.max(0, range)
    const prev = bars[i - 1]!.close
    return Math.max(range, Math.abs(bar.high - prev), Math.abs(bar.low - prev))
  })
}

/**
 * Canal nas velas do gráfico actual (como no TradingView ao mudar o intervalo).
 * O filtro arranca a ser desenhado depois do período, para não mostrar o aquecimento.
 */
export function computeGaussianChannel(
  bars: OhlcvBar[],
  opts?: { poles?: number; period?: number; multiplier?: number },
): GaussianChannelSeries | null {
  const poles = opts?.poles ?? GAUSSIAN_CHANNEL_POLES
  const period = opts?.period ?? GAUSSIAN_CHANNEL_PERIOD
  const mult = opts?.multiplier ?? GAUSSIAN_CHANNEL_MULT
  if (bars.length < period + 2) return null

  const source = bars.map((b) => (b.high + b.low + b.close) / 3)
  const filtered = gaussianFilter(source, period, poles)
  const filteredTr = gaussianFilter(trueRange(bars), period, poles)

  const mid: (number | null)[] = []
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []
  const rising: boolean[] = []
  let prev: number | null = null

  for (let i = 0; i < bars.length; i++) {
    if (i < period || !Number.isFinite(filtered[i]) || !Number.isFinite(filteredTr[i])) {
      mid.push(null)
      upper.push(null)
      lower.push(null)
      rising.push(false)
      continue
    }
    const center = filtered[i]!
    const half = Math.max(0, filteredTr[i]!) * mult
    mid.push(center)
    upper.push(center + half)
    lower.push(center - half)
    rising.push(prev == null ? true : center >= prev)
    prev = center
  }

  return { mid, upper, lower, rising }
}
