/**
 * Métricas estilo Glassnode calculadas só com preço (klines) — proxies educativas.
 * Não substituem dados on-chain reais (MVRV/SOPR/NUPL oficiais).
 */
import { ema, rsi, sma } from '@/lib/btc/indicators'

export type NullableSeries = (number | null)[]

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

/** MVRV proxy: razão preço / média longa, calibrada para faixas ~0.5–4. */
export function syntheticMvrv(closes: number[], smaPeriod = 200): NullableSeries {
  const base = sma(closes, smaPeriod)
  return closes.map((c, i) => {
    const s = base[i]
    if (s == null || s <= 0) return null
    return clamp((c / s) * 0.92, 0.15, 5)
  })
}

function rollingMeanStd(slice: number[]): { mean: number; std: number } | null {
  if (slice.length < 5) return null
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length
  const v = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length
  const std = Math.sqrt(v)
  return std > 1e-12 ? { mean, std } : null
}

/** Z-score rolante do MVRV proxy (topo/fundo relativos ao histórico recente). */
export function syntheticMvrvZScore(mvrv: NullableSeries, window = 90): NullableSeries {
  const n = mvrv.length
  const out: NullableSeries = Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - window + 1)
    const slice: number[] = []
    for (let j = start; j <= i; j++) {
      const v = mvrv[j]
      if (v != null) slice.push(v)
    }
    const ms = rollingMeanStd(slice)
    const v = mvrv[i]
    if (ms && v != null) out[i] = (v - ms.mean) / ms.std
  }
  return out
}

/** SOPR proxy: preço vs EMA curta (~1 = neutro). */
export function syntheticSopr(closes: number[], emaPeriod = 14): NullableSeries {
  const e = ema(closes, emaPeriod)
  return closes.map((c, i) => {
    const x = e[i]
    if (x == null || x <= 0) return null
    return clamp(c / x, 0.82, 1.18)
  })
}

/** NUPL proxy 0–100 a partir do desvio vs SMA200. */
export function syntheticNupl(closes: number[], smaPeriod = 200): NullableSeries {
  const s = sma(closes, smaPeriod)
  return closes.map((c, i) => {
    const m = s[i]
    if (m == null || m <= 0) return null
    const nu = (c - m) / m
    return clamp(50 + nu * 380, 0, 100)
  })
}

/** STH: RSI curto como proxy de “holders de curto prazo” (0–100). */
export function syntheticSth(closes: number[], rsiPeriod = 10): NullableSeries {
  return rsi(closes, rsiPeriod)
}

/** LTH: posição do preço vs tendência longa (0–100). */
export function syntheticLth(closes: number[], smaPeriod = 200): NullableSeries {
  const s = sma(closes, smaPeriod)
  return closes.map((c, i) => {
    const m = s[i]
    if (m == null || m <= 0) return null
    return clamp((c / m) * 48, 0, 100)
  })
}

export function nuplZoneLabel(v: number | null): string {
  if (v == null) return '—'
  if (v < 25) return 'Capitulação / medo'
  if (v < 45) return 'Esperança'
  if (v < 65) return 'Otimismo'
  return 'Euforia'
}
